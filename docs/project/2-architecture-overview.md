# Architecture Overview

> **Status**: Active
> **Scope**: 專案級架構總覽
> **Note**: 本文件描述現行架構與已規劃的 target state。尚未實作的部分標記為 `[Planned]`。

## 1. Layer Architecture

### Current State

```
┌──────────────────────────────────────────────────────────────┐
│            Layer 3: Interface Layer (src/agentic/)            │
│  MCP Tools │ CLI │ Audit Logger │ Skills                     │
│  sign_swap │ sign_permit │ get_address │ health_check        │
└──────────────────────────┬───────────────────────────────────┘
                           │
     ┌─────────────────────▼─────────────────┐
     │     PolicyEngine V1                    │  src/agentic/policy/
     │     evaluate(request)                  │
     │     → chainId/contract/selector checks │
     └─────────────────────┬─────────────────┘
                           │
     ┌─────────────────────▼─────────────────┐
     │  Layer 1: Core Signing                 │  src/core/
     │  SigningProvider → EvmSignerAdapter     │
     └───────────────────────────────────────┘
```

### Target State [Planned]

> Defined in [DeFi Protocol Integration Tech Spec](../features/defi-protocol-integration/2-tech-spec.md)

```
┌──────────────────────────────────────────────────────────────┐
│            Layer 3: Interface Layer (src/agentic/)            │
│  sign_swap (upgraded) │ sign_defi_call (new) │ sign_permit   │
│  Audit Logger │ CLI │ MCP Server                             │
└──────────┬────────────┴──────────┬───────────┴───────────────┘
           │                       │
     ┌─────▼───────────────────────▼───────┐
     │     Layer 2: Protocol Logic          │  src/protocols/ [Planned]
     │     ProtocolDispatcher               │
     │     → DecodedIntent → PolicyEngine   │
     └─────┬──────┬──────┬──────┬──────────┘
           │      │      │      │
    ┌──────▼┐ ┌───▼──┐ ┌─▼───┐ ┌▼────────┐
    │ERC-20 │ │Uni V3│ │Aave │ │ Unknown  │
    │decoder│ │decode│ │ V3  │ │→ REJECT  │
    └──────┬┘ └───┬──┘ └─┬───┘ └─────────┘
           │      │      │
     ┌─────▼──────▼──────▼─────────────────┐
     │  Layer 1: Core Signing (unchanged)   │  src/core/
     │  SigningProvider → EvmSignerAdapter   │
     └─────────────────────────────────────┘
```

### Layer Summary

| Layer | Path | Responsibility | MCP Dependency | Status |
|-------|------|---------------|---------------|--------|
| 1 | `src/core/` | Signing provider abstraction, EVM adapter | No | Implemented |
| 2 | `src/protocols/` | Protocol decoder, policy engine, calldata validation | No | [Planned] |
| 3 | `src/agentic/` | MCP server, CLI, audit, tools | Yes | Implemented |

## 2. Package Subpath Exports

### Current

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

### Target [Planned]

```json
{
  ".":           { "types": "./dist/index.d.ts",           "import": "./dist/index.js" },
  "./protocols": { "types": "./dist/protocols/index.d.ts", "import": "./dist/protocols/index.js" },
  "./agentic":   { "types": "./dist/agentic/index.d.ts",   "import": "./dist/agentic/index.js" }
}
```

| Subpath | Contents | MCP dep |
|---------|----------|---------|
| `.` | Core signing + type-only re-exports (backward compat, deprecated) | No |
| `./protocols` | Protocol decoder, dispatcher, PolicyEngine V2 | No |
| `./agentic` | MCP server, CLI, audit logger | Yes |

## 3. Trust Boundary

### Current

| Module | Allowed Imports | Prohibited |
|--------|----------------|------------|
| `src/core/**` | `viem`, internal core modules | `src/agentic/**` |
| `src/agentic/**` | `src/index.js` (root public API only) | Direct `src/core/**`, `src/providers/**` |

Enforced by `test/unit/agentic/trust-boundary.test.ts`.

### Target [Planned]

| Module | Allowed Imports | Prohibited |
|--------|----------------|------------|
| `src/core/**` | `viem`, internal core modules | `src/agentic/**`, `src/protocols/**` |
| `src/protocols/**` | `viem`, `src/core/**` | `@modelcontextprotocol/*`, `src/agentic/**` |
| `src/agentic/**` | `src/index.js`, `src/protocols/index.js` (public entrypoints only) | Direct `src/core/**`, `src/providers/**` |

Import asymmetry is intentional:
- `src/protocols/` imports from `src/core/` directly (peer domain module)
- `src/agentic/` imports only through public entrypoints (outer boundary)

## 4. Consumer Patterns

| Consumer | Import Path | Interface | Status |
|----------|------------|-----------|--------|
| AI Agent (MCP) | MCP `sign_swap` / `sign_permit` | MCP transport | Implemented |
| Claude Code (skills) | Skills → MCP tools | Skill markdown | Implemented |
| Developer (programmatic) | `@sd0xdev/agentic-vault/protocols` | TypeScript SDK | [Planned] |
| Backend service | `./protocols` + `.` (signer) | TypeScript SDK | [Planned] |

## 5. Feature Specs

| Feature | Tech Spec | Primary Layer |
|---------|-----------|--------------|
| Core Signer | [v0-initial-release/2-tech-spec.md](../features/v0-initial-release/2-tech-spec.md) (Superseded) | Layer 1 |
| DeFi Protocol Integration | [defi-protocol-integration/2-tech-spec.md](../features/defi-protocol-integration/2-tech-spec.md) | Layer 2 |

## References

- [Project Feasibility Study](./0-feasibility-study.md)
- [ADR-001 Architecture Decisions](./adrs/ADR-001-architecture-decisions.md)
