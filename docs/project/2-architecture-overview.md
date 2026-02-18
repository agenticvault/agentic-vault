# Architecture Overview

> **Status**: Active
> **Scope**: 專案級架構總覽
> **Note**: 本文件描述現行架構。各 section 保留 "Previous (v0)" 區塊以記錄演進歷程。

## 1. Layer Architecture

### Current State

```
┌──────────────────────────────────────────────────────────────┐
│            Layer 3: Interface Layer (src/agentic/)            │
│  sign_swap │ sign_defi_call │ sign_permit │ get_address      │
│  get_balance │ send_transfer │ send_erc20_transfer           │
│  health_check │ Audit Logger │ CLI │ MCP Server              │
└──────────┬────────────┴──────────┬───────────┴───────────────┘
           │                       │
     ┌─────▼───────────────────────▼───────┐
     │     Layer 2: Protocol Logic          │  src/protocols/
     │     ProtocolDispatcher               │
     │     → DecodedIntent → PolicyEngine   │
     │     Workflows: sign-defi-call,       │
     │       get-balance, send-transfer,    │
     │       send-erc20-transfer            │
     └─────┬──────┬──────┬──────┬──────────┘
           │      │      │      │
    ┌──────▼┐ ┌───▼──┐ ┌─▼───┐ ┌▼────────┐
    │ERC-20 │ │Uni V3│ │Aave │ │ Unknown  │
    │decoder│ │decode│ │ V3  │ │→ REJECT  │
    └──────┬┘ └───┬──┘ └─┬───┘ └─────────┘
           │      │      │
     ┌─────▼──────▼──────▼─────────────────┐
     │  Layer 1: Core Signing               │  src/core/
     │  SigningProvider → EvmSignerAdapter   │
     └─────────────────────────────────────┘
           │
     ┌─────▼───────────────────────────────┐
     │  RPC Layer (optional)                │  src/rpc/
     │  ViemRpcProvider (balance, gas, tx)  │
     └─────────────────────────────────────┘
```

### Layer Summary

| Layer | Path | Responsibility | MCP Dependency | Status |
|-------|------|---------------|---------------|--------|
| 1 | `src/core/` | Signing provider abstraction, EVM adapter | No | Implemented |
| RPC | `src/rpc/` | On-chain reads, gas estimation, tx broadcast | No | Implemented |
| 2 | `src/protocols/` | Protocol decoder, policy engine, workflows | No | Implemented |
| 3 | `src/agentic/` | MCP server, CLI, audit, tools | Yes | Implemented |

## 2. Package Subpath Exports

### Previous (v0)

```json
{
  ".":         { "types": "./dist/index.d.ts",         "import": "./dist/index.js" },
  "./agentic": { "types": "./dist/agentic/index.d.ts", "import": "./dist/agentic/index.js" }
}
```

| Subpath | Contents | MCP dep |
|---------|----------|---------|
| `.` | Core signing (SigningProvider, EvmSignerAdapter, factory) + legacy KMS re-exports + type-only policy re-exports | No |
| `./agentic` | MCP server, CLI, audit logger, PolicyEngine | Yes |

### Current

```json
{
  ".":           { "types": "./dist/index.d.ts",           "import": "./dist/index.js" },
  "./protocols": { "types": "./dist/protocols/index.d.ts", "import": "./dist/protocols/index.js" },
  "./agentic":   { "types": "./dist/agentic/index.d.ts",   "import": "./dist/agentic/index.js" }
}
```

| Subpath | Contents | MCP dep |
|---------|----------|---------|
| `.` | Core signing (SigningProvider, EvmSignerAdapter, factory) + ViemRpcProvider + type-only policy re-exports | No |
| `./protocols` | Protocol decoder, dispatcher, PolicyEngine, workflows | No |
| `./agentic` | MCP server, CLI, audit logger | Yes |

## 3. Trust Boundary

### Previous (v0)

| Module | Allowed Imports | Prohibited |
|--------|----------------|------------|
| `src/core/**` | `viem`, internal core modules | `src/agentic/**` |
| `src/agentic/**` | `src/index.js` (root public API only) | Direct `src/core/**`, `src/providers/**` |

Enforced by `test/unit/agentic/trust-boundary.test.ts`.

### Current

| Module | Allowed Imports | Prohibited |
|--------|----------------|------------|
| `src/core/**` | `viem`, internal core modules | `src/agentic/**`, `src/protocols/**` |
| `src/rpc/**` | `viem`, `src/protocols/` (catalog + types) | `src/agentic/**`, `@modelcontextprotocol/*` |
| `src/protocols/**` | `viem`, `zod`, `src/core/**` | `@modelcontextprotocol/*`, `src/agentic/**` |
| `src/agentic/**` | `src/index.js`, `src/protocols/index.js` (public entrypoints only) | Direct `src/core/**`, `src/providers/**` |

Import asymmetry is intentional:
- `src/protocols/` imports from `src/core/` directly (peer domain module)
- `src/agentic/` imports only through public entrypoints (outer boundary)
- `src/rpc/` is a standalone module, exposed via root `src/index.ts`

## 4. Consumer Patterns

| Consumer | Import Path | Interface | Status |
|----------|------------|-----------|--------|
| AI Agent (MCP) | MCP `sign_swap` / `sign_permit` | MCP transport | Implemented |
| Claude Code (skills) | Skills → MCP tools | Skill markdown | Implemented |
| Developer (programmatic) | `@agenticvault/agentic-vault/protocols` | TypeScript SDK | [Planned] |
| Backend service | `./protocols` + `.` (signer) | TypeScript SDK | [Planned] |

## 5. Feature Specs

| Feature | Tech Spec | Primary Layer |
|---------|-----------|--------------|
| Core Signer | [v0-initial-release/2-tech-spec.md](../features/v0-initial-release/2-tech-spec.md) (Superseded) | Layer 1 |
| DeFi Protocol Integration | [defi-protocol-integration/2-tech-spec.md](../features/defi-protocol-integration/2-tech-spec.md) | Layer 2 |
| Transfer & Balance | [transfer-balance/2-tech-spec.md](../features/transfer-balance/2-tech-spec.md) | Layer 2 + RPC |

## References

- [Project Feasibility Study](./0-feasibility-study.md)
- [ADR-001 Architecture Decisions](./adrs/ADR-001-architecture-decisions.md)
