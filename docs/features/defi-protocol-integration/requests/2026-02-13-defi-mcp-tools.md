# DeFi MCP Tools + Uniswap V3 Decoder

> **Created**: 2026-02-13
> **Status**: Done (locally complete, pending commit)
> **Priority**: P1
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 3)
> **Feasibility Study**: [../0-feasibility-study.md](../0-feasibility-study.md)
> **Depends on**: [2026-02-13-protocol-decoder-framework.md](./2026-02-13-protocol-decoder-framework.md)

## Background

新增 `sign_defi_call` MCP 工具，提供通用 DeFi 合約互動簽名（經解碼器驗證）。升級現有 `sign_swap` 改走 decoder pipeline。新增 Uniswap V3 SwapRouter02 解碼器與策略評估器。

## Requirements

### MCP Tools

| Tool | File | Description | Status |
|------|------|-------------|--------|
| `sign_defi_call` | `src/agentic/mcp/tools/sign-defi-call.ts` | 通用 DeFi 簽名工具（decode → policy → sign） | New |
| `sign_swap` | `src/agentic/mcp/tools/sign-swap.ts` | 升級改走 decoder pipeline，reject unknown calldata | Upgrade |

### Uniswap V3 Decoder

| Item | Description | Status |
|------|-------------|--------|
| `src/protocols/decoders/uniswap-v3.ts` | SwapRouter02 `exactInputSingle` ABI + 解碼 | Done |
| `src/protocols/policy/evaluators/uniswap-v3.ts` | Token pair, non-zero slippage guard (`maxSlippageBps` 時拒絕 `amountOutMinimum=0`), recipient 驗證 | Done |
| Contract registry | 註冊 mainnet (`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`) + Sepolia (`0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`) SwapRouter02 地址 | Done |

### ToolContext Extension

| Item | Description |
|------|-------------|
| `shared.ts` | 新增 `ToolDispatcher` 介面、`ToolContext.dispatcher?` |
| `server.ts` | `createMcpServer` 注入預設 `ProtocolDispatcher` |

## Scope

| Scope | Description |
|-------|-------------|
| In | `sign_defi_call` 工具、`sign_swap` 升級、Uniswap V3 解碼器、ToolContext 擴充 |
| Out | Aave V3 解碼器、REST API、service layer |

## Acceptance Criteria

### sign_defi_call
- [x] `sign_defi_call` MCP 工具已註冊且可呼叫（`src/agentic/mcp/tools/sign-defi-call.ts`）
- [x] Unknown calldata → rejected（MCP text content 回傳 error）+ audit log
- [x] Policy denied → violations（MCP text content）+ audit log
- [x] 成功簽名 → signedTx（MCP text content）+ audit log (approved)
- [x] 無 dispatcher 時 throw clear error

### sign_swap 升級
- [x] `sign_swap` 經過 decoder pipeline，unknown calldata 被拒絕
- [x] `sign_swap` 向後相容：相同 input schema
- [x] `sign_swap` 無 dispatcher 時 throw clear error（與 `sign_defi_call` 行為一致）

### Uniswap V3 Decoder
- [x] `exactInputSingle` calldata 正確解碼
- [x] 策略驗證 token pair / non-zero slippage guard / recipient（完整 bps 驗證需 oracle，已 deferred）

### ToolContext + Registration
- [x] `ToolContext.dispatcher` 為 optional（向後相容）
- [x] `createMcpServer` 注入預設 dispatcher
- [x] `src/agentic/mcp/tools/index.ts` 註冊 `sign_defi_call`
- [x] Safe tool count test（`test/unit/agentic/security/unsafe-flag.test.ts`）已更新

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過
- [x] `pnpm build` 成功

## Dependencies

- Protocol Decoder Framework (Phase 1+2)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec completed |
| Development | Done | Phase 3a (MCP tools + ToolContext) + Phase 3b (Uniswap V3 decoder + evaluator) |
| Testing | Done | 284 unit + 25 integration + 12 E2E pass (vitest run, pre-commit) |
| Acceptance | Done | 17/17 AC checked |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (sections 4.5-4.7, 6.1)
- Feasibility Study: [../0-feasibility-study.md](../0-feasibility-study.md)
- Uniswap V3 SwapRouter02 ABI: [IV3SwapRouter.sol](https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol)
