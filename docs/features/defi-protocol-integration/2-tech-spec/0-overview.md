# DeFi Protocol Integration — Technical Specification

> Based on [Feasibility Study](../0-feasibility-study.md) — Solution C (Hybrid: viem-native wallet + external DeFi router)
> Architecture updated per interface-agnostic brainstorm (2026-02-13)

## Document Index

| # | File | Sections | Content |
|---|------|----------|---------|
| 0 | **Overview** (this file) | 1–2 | Overview, Architecture, Trust Boundary |
| 1 | [Type Definitions](./1-type-definitions.md) | 3 | DecodedIntent, Contract Registry, Policy V2 |
| 2 | [Module Specifications](./2-module-specs.md) | 4–5 | Decoders, Dispatcher, Policy Engine, MCP Tools, Workflows, CLI |
| 3 | [Diagrams, Testing & Security](./3-diagrams-testing-security.md) | 6–8 | Sequence Diagrams, Test Plan, Security |
| 4 | [Migration Phases 1–7](./4-migration-phases-1-7.md) | 9 (1–7) | Core protocol migration |
| 5 | [OpenClaw Plugin](./5-openclaw-plugin.md) | 4.10–4.11, Phase 8 | Plugin architecture & implementation |
| 6 | [Migration Phases 9–10](./6-migration-phases-9-10.md) | 9 (9–10) | Onboarding, Multi-Chain RPC |
| 7 | [Decisions](./7-decisions.md) | 10–11 | Deferred & Open Decisions |

---

## 1. Overview

| Field | Value |
| --- | --- |
| Feature | Calldata-aware DeFi signing with protocol-level policy enforcement |
| Scope | Protocol decoder framework, Policy V2, `sign_defi_call` MCP tool, `sign_swap` upgrade |
| Protocols | ERC-20, Uniswap V3 (SwapRouter02), Aave V3 (Pool) |
| Dependencies | Zero new runtime dependencies (viem-native) |
| Core impact | `src/core/` unchanged |

### 1.1 Consumer Patterns

The protocol decoder and policy engine are **interface-agnostic**. Phase 6 extracted shared business logic into `src/protocols/workflows/`, consumed by all policy-governed signing surfaces:

| Consumer | Entry | Interface | What They Get |
| --- | --- | --- | --- |
| Human (CLI) [Phase 6b] | `agentic-vault sign` | Interactive CLI | Same decode+policy+sign pipeline, human-readable output |
| AI Agent (MCP) | MCP `sign_defi_call` / `sign_swap` | MCP transport | Full decode+policy+sign pipeline |
| AI Agent (OpenClaw) [Phase 8] | `@agenticvault/agentic-vault-openclaw` | OpenClaw plugin `api.registerTool()` | Same workflow pipeline, OpenClaw-native tool registration |
| Developer (SDK) | `@agenticvault/agentic-vault/protocols` | TypeScript SDK | Dispatcher, PolicyEngine, Decoders — no MCP/CLI pulled (Workflows added in Phase 6a) |
| Claude Code (skills) | Skills → MCP tools | Skill markdown | Governance-consistent signing |
| Backend service | `./protocols` + `.` (signer) | TypeScript SDK | Custom orchestration without MCP |

> **Design principle**: All policy-governed signing flows share the same workflow layer. Interface adapters (MCP tools, CLI commands, OpenClaw tools) are thin I/O adapters that parse input → call workflow → format output. Non-signing utilities (`encode`, `decode`) and unsafe-gated raw signing tools (`sign_transaction`, `sign_typed_data`) bypass the workflow layer by design.

### 1.2 Package Subpath Exports

```json
{
  ".":           { "types": "./dist/index.d.ts",           "import": "./dist/index.js" },
  "./protocols": { "types": "./dist/protocols/index.d.ts", "import": "./dist/protocols/index.js" },
  "./agentic":   { "types": "./dist/agentic/index.d.ts",   "import": "./dist/agentic/index.js" }
}
```

| Subpath | Contents | MCP dependency |
| --- | --- | --- |
| `.` | Core signing (SigningProvider, EvmSignerAdapter, factory) + type-only re-exports of PolicyConfig/PolicyRequest/PolicyEvaluation/AuditEntry (backward compat, deprecated) | No |
| `./protocols` | Protocol decoder, dispatcher, PolicyEngine V2 (canonical path for policy types) | No |
| `./agentic` | MCP server, audit logger (CLI is accessed via `bin` entries, not subpath export) | Yes |

> **Backward compat note**: Current `src/index.ts` re-exports `PolicyConfig`, `PolicyRequest`, `PolicyEvaluation`, and `AuditEntry` as type-only. These are preserved in v0.1.x for backward compat but deprecated — consumers should migrate to `@agenticvault/agentic-vault/protocols`.

## 2. Architecture

### 2.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│            Layer 3: Interface Adapters (thin I/O)                    │
│                                                                     │
│  ┌─── MCP (src/agentic/mcp/) ─✅─┐  ┌── CLI (src/cli/) [Phase 6] ┐ │
│  │ sign_swap │ sign_defi_call    │  │ sign │ sign-permit │ dry-run│ │
│  │ sign_permit │ MCP Server      │  │ encode │ decode │ ...    │ │
│  └──────────────┬────────────────┘  └──────────┬─────────────────┘ │
│                                                                     │
│  ┌── OpenClaw (@agenticvault/agentic-vault-openclaw) [Phase 8] ─────────────┐ │
│  │ vault_sign_defi_call │ vault_sign_permit │ vault_get_address          │ │
│  │ vault_health_check │ vault_get_balance │ vault_send_* │ ...          │ │
│  └──────────────┬──────────────────────────────────────────────────────┘ │
└─────────────────┼──────────────────────────────┼───────────────────┘
                  │                              │
     ┌────────────▼──────────────────────────────▼──────────────┐
     │  Layer 2b: Workflows (src/protocols/workflows/) [Phase 6]│
     │  signDefiCall(ctx) → SignDefiCallResult                  │
     │  signPermit(ctx) → SignPermitResult                      │
     │  AuditSink injection │ caller tag │ typed domain results │
     └────────────────────────────┬─────────────────────────────┘
                                  │
     ┌────────────────────────────▼─────────────────────────────┐
     │  Layer 2a: Protocol Logic (src/protocols/)               │
     │  ProtocolDispatcher → Decoders → PolicyEngine V2         │
     └─────┬──────┬──────┬──────┬───────────────────────────────┘
           │      │      │      │
    ┌──────▼┐ ┌───▼──┐ ┌─▼───┐ ┌▼────────┐
    │ERC-20 │ │Uni V3│ │Aave │ │ Unknown  │
    │decoder│ │decode│ │ V3  │ │→ REJECT  │
    └───────┘ └──────┘ └─────┘ └─────────┘
                                  │
     ┌────────────────────────────▼─────────────────────────────┐
     │  Layer 1: Core Signing (unchanged)                       │  src/core/
     │  SigningProvider → EvmSignerAdapter                      │
     └─────────────────────────────────────────────────────────┘
```

### 2.2 File Structure

#### Current State

```
src/
├── core/                         # Layer 1: Signing (unchanged)
│   ├── signing-provider.ts
│   └── evm-signer-adapter.ts
├── protocols/                    # Layer 2a: Protocol logic ✅
│   ├── index.ts                  # Public entrypoint for ./protocols subpath
│   ├── types.ts                  # DecodedIntent, ProtocolDecoder interfaces
│   ├── catalog.ts                # Protocol Action Catalog (shared ABI metadata) [Phase 7a]
│   ├── registry.ts               # Contract registry (chainId+address → protocol)
│   ├── dispatcher.ts             # dispatch(chainId, to, data) → DecodedIntent
│   ├── decoders/
│   │   ├── erc20.ts              # ERC-20 ABI + decoder ✅
│   │   ├── uniswap-v3.ts         # Uniswap V3 SwapRouter02 ABI + decoder ✅
│   │   └── aave-v3.ts            # Aave V3 Pool ABI + decoder ✅
│   └── policy/
│       ├── types.ts              # PolicyConfigV2, PolicyRequestV2, ProtocolPolicyEvaluator
│       ├── engine.ts             # PolicyEngine (V1 evolved to V2 in place) ✅
│       └── evaluators/
│           ├── erc20.ts          # ERC-20 policy (allowance cap, spender allowlist) ✅
│           ├── uniswap-v3.ts     # Uniswap policy (token pair, slippage, recipient) ✅
│           └── aave-v3.ts        # Aave V3 policy (asset allowlist, interest rate mode) ✅
├── provider/                     # Provider factory (unchanged)
├── providers/                    # Provider implementations (unchanged)
├── agentic/                      # Layer 3: MCP interface
│   ├── audit/                    # AuditLogger
│   ├── policy/                   # Re-export bridge (deprecated → use ./protocols)
│   ├── mcp/
│   │   ├── server.ts             # Injects default ProtocolDispatcher
│   │   └── tools/
│   │       ├── shared.ts         # ToolContext with optional dispatcher
│   │       ├── decoded-call-pipeline.ts  # Shared decode→policy→sign pipeline
│   │       ├── sign-defi-call.ts # DeFi signing with decoder
│   │       ├── sign-swap.ts      # Routes through decoder pipeline
│   │       └── ...               # Existing tools unchanged
│   ├── cli.ts                    # MCP server CLI entry
│   └── index.ts                  # Re-exports PolicyEngine + protocol types
└── index.ts                      # Root exports (core + provider)
```

#### Target State (Phase 4 ✅ + Phase 6 ✅)

Phase 4 added Aave V3 decoder/evaluator. Phase 6 added workflow layer and CLI.

```
src/protocols/
│   ├── decoders/
│   │   └── aave-v3.ts            # Aave V3 Pool ABI + decoder ✅
│   ├── policy/evaluators/
│   │   └── aave-v3.ts            # Aave policy ✅
│   └── workflows/                # Layer 2b: Shared business logic [Phase 6a]
│       ├── index.ts              # Re-exports all workflows
│       ├── types.ts              # WorkflowContext, AuditSink, domain result types
│       ├── sign-defi-call.ts     # decode → policy → sign → audit → domain result
│       ├── sign-permit.ts        # validate → policy → sign → audit → domain result
│       ├── get-address.ts        # get signer address
│       ├── health-check.ts       # health check
│       ├── get-balance.ts        # get native/token balance (requires RPC)
│       └── send-transfer.ts      # send ETH/ERC-20 transfer (requires RPC)
src/cli/                          # Layer 3: CLI interface adapter [Phase 6b+7]
│   ├── index.ts                  # CLI entry, manual switch routing
│   ├── commands/
│   │   ├── sign.ts               # sign subcommand → workflow → output (+TTY confirm, --yes) [7e]
│   │   ├── sign-permit.ts        # sign-permit subcommand → workflow → output (+--file) [7d]
│   │   ├── dry-run.ts            # dry-run subcommand → decode only (no signing) (+stdin) [7c]
│   │   ├── encode.ts             # encode subcommand → intent params → calldata [7a]
│   │   ├── decode.ts             # decode subcommand → calldata → intent JSON [7a]
│   │   ├── get-address.ts        # get-address subcommand
│   │   ├── health.ts             # health subcommand
│   │   └── mcp.ts                # mcp subcommand (starts stdio MCP server)
│   └── formatters.ts             # Output formatters + stdin + TTY helpers [7b/7c/7e]
```

> **Binary naming (Phase 6b)**: `agentic-vault` (main entry) + `agentic-vault-mcp` (legacy MCP entry). Both defined in `package.json` `bin` field. Note: `agentic-vault-mcp` (`src/agentic/cli.ts`) supports `--rpc-url` and wires `ViemRpcProvider`; `agentic-vault mcp` (`src/cli/commands/mcp.ts`) does not yet support RPC args — they are only partially equivalent.

### 2.3 Trust Boundary

| Module | Allowed Imports | Prohibited |
| --- | --- | --- |
| `src/protocols/**` | `viem`, internal protocol modules (currently no direct `src/core/` imports) | `@modelcontextprotocol/*`, `src/agentic/**` |
| `src/agentic/**` | `src/index.js` (root) + `src/protocols/index.js` (via relative path) | Direct `src/core/**`, `src/providers/**` |
| `src/core/**` | `viem`, internal core modules | `src/agentic/**`, `src/protocols/**` |
| `@agenticvault/agentic-vault-openclaw` [Phase 8] | `@agenticvault/agentic-vault` (root) + `@agenticvault/agentic-vault/protocols` + `openclaw/plugin-sdk` | Internal `src/` paths, `@modelcontextprotocol/*` |

The trust boundary test (`test/unit/agentic/trust-boundary.test.ts`) resolves each relative import path and checks against two allowed targets:

```typescript
// test/unit/agentic/trust-boundary.test.ts:83-86
const allowedTargets = [
  resolve(srcDir, 'index.js'),              // root public API
  resolve(srcDir, 'protocols', 'index.js'), // protocols public API
];
```

Import asymmetry is intentional:
- `src/protocols/` is a peer domain module — imports `viem` directly (no agentic trust-boundary restriction; currently no direct `src/core/` imports)
- `src/agentic/` is the outer interface boundary — imports only through public entrypoints (`index.js`, `protocols/index.js`)

### 2.4 Backward Compatibility Bridge

Existing consumers import `PolicyEngine` from `@agenticvault/agentic-vault/agentic`. The policy engine moves to `src/protocols/policy/`, so `src/agentic/index.ts` re-exports it:

```typescript
// src/agentic/index.ts — compatibility bridge
// @deprecated Use @agenticvault/agentic-vault/protocols instead
export { PolicyEngine } from '../protocols/index.js';
export type {
  PolicyConfig, PolicyRequest, PolicyEvaluation,
  PolicyConfigV2, PolicyRequestV2, ProtocolPolicyConfig, ProtocolPolicyEvaluator,
} from '../protocols/index.js';
```

This bridge will be removed in a future version. The canonical import path is `@agenticvault/agentic-vault/protocols`.
