# Multi-Chain RPC Support

| Field | Value |
|-------|-------|
| Date | 2026-02-20 |
| Status | Pending |
| Priority | P1 |
| Feature | DeFi Protocol Integration |
| Phase | 10 |

## Problem

`ViemRpcProvider` only accepts a single `rpcUrl`, which is reused for all chain IDs. When users configure an RPC endpoint for one chain (e.g. Sepolia) and request an operation on a different chain (e.g. mainnet), the provider throws:

```
Chain ID mismatch: requested 1 but RPC endpoint returned 11155111
```

This forces users to reconfigure the vault every time they switch chains — unacceptable for multi-chain DeFi workflows (e.g. mainnet USDC + Sepolia testing, L2 bridging).

## Root Cause

```typescript
// src/rpc/viem-rpc-provider.ts:66
const transport = this.rpcUrl ? http(this.rpcUrl) : http();
// Same URL used for ALL chains → mismatch when chainId differs
```

The `WorkflowRpcProvider` interface is already per-chain (every method takes `chainId` as first parameter), but the implementation bottleneck is in `ViemRpcProvider.initClient()` which uses a single URL.

## Solution

A+D Hybrid approach (Claude + Codex Nash Equilibrium, 2026-02-20):

**URL resolution priority** (per `chainId`):

```
rpcUrls[chainId]  →  rpcUrl (legacy)  →  viem public RPC  →  Error
    ①                    ②                    ③                ④
```

| Priority | Source | When Used |
|----------|--------|-----------|
| 1 | `rpcUrls[chainId]` | Explicit per-chain URL configured |
| 2 | `rpcUrl` | Legacy single URL fallback (backward compat) |
| 3 | viem public RPC | Known chain (10 built-in) with no explicit URL |
| 4 | Error | Unknown chain + no URL configured |

## Config Surface

### CLI / MCP Server

```bash
# Per-chain URLs (new)
--rpc-urls "1=https://eth-mainnet.g.alchemy.com/v2/KEY,11155111=https://eth-sepolia.g.alchemy.com/v2/KEY"

# Or env var
VAULT_RPC_URLS="1=https://...,11155111=https://..."

# Legacy single URL (still works — becomes fallback)
--rpc-url https://eth-mainnet.g.alchemy.com/v2/KEY
```

### OpenClaw Plugin Config

```json
{
  "plugins": {
    "entries": {
      "agentic-vault-openclaw": {
        "config": {
          "keyId": "alias/agentic-vault-signer",
          "region": "ap-northeast-1",
          "rpcUrls": {
            "1": "https://eth-mainnet.g.alchemy.com/v2/KEY",
            "11155111": "https://eth-sepolia.g.alchemy.com/v2/KEY",
            "42161": "https://arb-mainnet.g.alchemy.com/v2/KEY"
          },
          "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/KEY"
        }
      }
    }
  }
}
```

## Acceptance Criteria

- [ ] `ViemRpcProvider` accepts `rpcUrls: Record<number, string>` in constructor
- [ ] URL resolution follows 4-level priority (rpcUrls > rpcUrl > public > error)
- [ ] CLI supports `--rpc-urls` flag and `VAULT_RPC_URLS` env var
- [ ] OpenClaw plugin supports `rpcUrls` config field
- [ ] Existing `rpcUrl`-only configs continue to work unchanged
- [ ] Chain ID mismatch validation per resolved URL
- [ ] Unit tests cover all resolution paths (explicit, fallback, public, error)
- [ ] Known chains (10 built-in) work without any RPC config
- [ ] Unknown chains with `rpcUrls[chainId]` work correctly

## Files to Modify

| File | Change |
|------|--------|
| `src/rpc/viem-rpc-provider.ts` | Add `rpcUrls` to constructor, update `initClient` resolution |
| `packages/openclaw-plugin/src/types.ts` | Add `rpcUrls?: Record<string, string>` |
| `packages/openclaw-plugin/src/context.ts` | Pass `rpcUrls` to `ViemRpcProvider` |
| `src/agentic/cli.ts` | Parse `--rpc-urls` flag, `VAULT_RPC_URLS` env |
| `test/unit/rpc/viem-rpc-provider.test.ts` | Test all resolution paths |
| `packages/openclaw-plugin/test/unit/context.test.ts` | Test multi-chain config |

## Progress

| Phase | Status |
|-------|--------|
| Brainstorm | Done |
| Tech Spec | In Progress |
| Implementation | Pending |
| Testing | Pending |
| Doc Update | Pending |

## Related

- [Tech Spec Phase 10](../2-tech-spec.md) (to be added)
- Brainstorm: Claude + Codex Nash Equilibrium (2026-02-20)
