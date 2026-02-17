# Native Transfer and Balance Query

> **Created**: 2026-02-17
> **Status**: Complete
> **Priority**: P1

## Background

Currently agentic-vault MCP tools only support DeFi contract interactions (swap, permit, defi_call) and basic health/address queries. There is no way to perform a simple ETH transfer or check wallet balance. These are fundamental wallet operations needed for practical use, especially for the OpenClaw plugin.

## Requirements

- MCP: Add `get_balance` tool (query native ETH + ERC20 token balance)
- MCP: Add `send_transfer` tool (native ETH transfer with policy validation)
- MCP: Add `send_erc20_transfer` tool (ERC20 token transfer with policy validation)
- OpenClaw: Register corresponding `vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer` tools
- All tools must support `chainId` parameter for multi-chain use
- Transfer tools must go through policy engine validation
- Transfer tools must emit audit logs

## Scope

| Scope | Description |
| ----- | ---------------------------------- |
| In | Native ETH transfer, ERC20 transfer, balance query (native + ERC20), policy validation, audit logging |
| Out | Batch transfers, gas estimation tool, token approval (use existing permit), cross-chain bridge |

## Related Files

| File | Action | Description |
| ---- | ------ | ----------- |
| `src/agentic/mcp/tools/get-balance.ts` | New | Balance query tool (native + ERC20) |
| `src/agentic/mcp/tools/send-transfer.ts` | New | Native ETH transfer tool |
| `src/agentic/mcp/tools/send-erc20-transfer.ts` | New | ERC20 token transfer tool |
| `src/agentic/mcp/tools/index.ts` | Modify | Register new tools |
| `src/agentic/mcp/tools/shared.ts` | Modify | Add `ToolRpcProvider` interface |
| `src/protocols/workflows/send-transfer.ts` | New | Transfer workflow (sign + broadcast) |
| `src/protocols/workflows/get-balance.ts` | New | Balance query workflow |
| `src/protocols/workflows/types.ts` | Modify | Add `WorkflowRpcProvider`, `WorkflowContext.rpcProvider` |
| `src/protocols/workflows/index.ts` | Modify | Export new workflows |
| `src/protocols/catalog.ts` | Modify | Add `erc20TransferAbi` |
| `src/rpc/viem-rpc-provider.ts` | New | Viem-based RPC provider implementation |
| `src/rpc/index.ts` | New | RPC module barrel export |
| `src/agentic/cli.ts` | Modify | Add `--rpc-url` / `VAULT_RPC_URL` support |
| `packages/openclaw-plugin/src/tools.ts` | Modify | Register vault_get_balance, vault_send_transfer, vault_send_erc20_transfer |
| `packages/openclaw-plugin/src/context.ts` | Modify | Wire rpcProvider into OpenClaw context |
| `packages/openclaw-plugin/src/types.ts` | Modify | Add rpcUrl to config type |
| `packages/openclaw-plugin/openclaw.plugin.json` | Modify | Add rpcUrl to configSchema |
| `test/unit/agentic/mcp/tools/get-balance.test.ts` | New | Unit tests |
| `test/unit/agentic/mcp/tools/send-transfer.test.ts` | New | Unit tests |
| `test/unit/agentic/mcp/tools/send-erc20-transfer.test.ts` | New | Unit tests |
| `test/unit/protocols/workflows/get-balance.test.ts` | New | Workflow unit tests |
| `test/unit/protocols/workflows/send-transfer.test.ts` | New | Workflow unit tests |
| `test/unit/rpc/viem-rpc-provider.test.ts` | New | RPC provider unit tests |
| `test/integration/mcp-transfer-balance-pipeline.test.ts` | New | Integration: real PolicyEngine + Dispatcher |
| `test/e2e/mcp-server.test.ts` | Modify | E2E: round-trip MCP calls for 3 new tools |
| `packages/openclaw-plugin/test/unit/tools.test.ts` | Modify | Add OpenClaw tool tests |
| `packages/openclaw-plugin/test/integration/plugin-load.test.ts` | Modify | Update tool count assertions |

## Acceptance Criteria

- [x] `get_balance` returns native ETH balance for any address + chain
- [x] `get_balance` returns ERC20 token balance when token address provided
- [x] `send_transfer` signs and broadcasts native ETH transfer
- [x] `send_erc20_transfer` signs and broadcasts ERC20 transfer (via transfer(to, amount) calldata)
- [x] Transfer tools reject when policy engine denies
- [x] Transfer tools emit structured audit logs
- [x] OpenClaw plugin exposes all 3 new tools
- [x] Unit test coverage > 80% (641 unit tests pass)
- [x] Pass /codex-review-fast
- [x] Pass /precommit (lint + build + 641 tests)

## Progress

| Phase | Status | Note |
| ----------- | ------ | ---- |
| Analysis | ✅ Complete | Tech spec + request doc created |
| Development | ✅ Complete | 37 files, 3201 insertions; all tools + workflows + RPC provider |
| Testing | ✅ Complete | Unit (641), Integration (15), E2E (27), Plugin (3) |
| Acceptance | ✅ Complete | All 10/10 criteria met |

## References

- Existing tool pattern: `src/agentic/mcp/tools/sign-swap.ts`
- Existing workflow pattern: `src/protocols/workflows/sign-defi-call.ts`
- OpenClaw tool pattern: `packages/openclaw-plugin/src/tools.ts`
