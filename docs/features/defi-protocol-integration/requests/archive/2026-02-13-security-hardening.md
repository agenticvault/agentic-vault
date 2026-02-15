# Security Hardening + Code Quality

> **Created**: 2026-02-13
> **Status**: Done
> **Priority**: P0
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 5)
> **Depends on**: [2026-02-13-defi-mcp-tools.md](./2026-02-13-defi-mcp-tools.md)
> **Source**: Adversarial brainstorming (Claude + Codex independent research)

## Background

Phase 3 完成後，Claude 與 Codex 獨立研究 codebase 進行對抗式分析，發現兩個 P0 安全漏洞與數個架構改善機會。

## Requirements

### 5a. `sign_permit` message-vs-args bypass (P0 Security)

| 問題 | 說明 |
|------|------|
| 漏洞 | Policy 驗證基於 top-level `args.value/deadline`，但實際簽名使用 `args.message` 中的值 |
| 攻擊 | 提交合規 args + 惡意 message → 繞過 policy 簽名不同金額/期限 |
| 影響 | `src/agentic/mcp/tools/sign-permit.ts` |

修復方向：
1. 從 `args.message` 解析 `value`, `spender`, `deadline`，與 top-level args 嚴格比對
2. 不一致時 → rejected + audit log

### 5b. MCP Input Schema 結構驗證 (P0 Security)

| 問題 | 說明 |
|------|------|
| 漏洞 | `to`/`data` 接受任意 string，`as 0x${string}` 強轉無驗證 |
| 攻擊 | 非 hex、缺少 0x prefix、長度不正確的 input 可造成下游異常 |
| 影響 | `sign-swap.ts`, `sign-defi-call.ts`, `sign-permit.ts`, `sign-transaction.ts` |

修復方向：
1. 建立共用 zod schema helpers（`hexAddress`, `hexData`, `positiveChainId`）
2. 所有 MCP tool input 改用 refined schema
3. 失敗回傳 user-friendly error message

### 5c. CLI Evaluator 接線 (P1 Architecture)

| 問題 | 說明 |
|------|------|
| 缺陷 | CLI 只註冊 `erc20Evaluator`，Uniswap V3 evaluator 未接線 |
| 影響 | 生產環境 Uniswap V3 intent 被 fail-closed 拒絕 |
| 檔案 | `src/agentic/cli.ts:115` |

修復方向：引入所有已支援 evaluator（`erc20Evaluator`, `uniswapV3Evaluator`）

### 5d. Tool Handler 重複消除 (P1 Code Quality)

| 問題 | 說明 |
|------|------|
| 重複 | `sign_swap` 與 `sign_defi_call` 共享 ~90% pipeline 邏輯 |
| 風險 | 修改需同步兩處，drift 導致行為不一致 |
| 檔案 | `sign-swap.ts`, `sign-defi-call.ts` |

修復方向：提取 `signDecodedCall(ctx, toolName, args)` 共用 pipeline

### 5e. PolicyEngine Set 預處理 (P2 Performance)

| 問題 | 說明 |
|------|------|
| 浪費 | `evaluateBase()` 每次請求 lowercase + map allowlists |
| 影響 | `src/protocols/policy/engine.ts:55-67` |

修復方向：constructor 預處理為 `Set<string>`

## Scope

| Scope | Description |
|-------|-------------|
| In | sign_permit 修復、schema validation、CLI 接線、tool dedup、PolicyEngine 優化 |
| Out | 新增協議支援（Aave V3 為獨立需求單）、oracle-based slippage 驗證 |

## Acceptance Criteria

### 5a. sign_permit bypass
- [x] `args.message.value` 與 `args.value` 不一致 → rejected + audit log
- [x] `args.message.deadline` 與 `args.deadline` 不一致 → rejected + audit log
- [x] `args.message.spender` 與 `args.spender` 不一致 → rejected + audit log
- [x] 一致時行為不變（backward compatible）
- [x] 新增 exploit-focused 單元測試

### 5b. Input schema validation
- [x] `to` 欄位驗證：`0x` prefix + 42 char + hex-only（`sign_swap`, `sign_defi_call`, `sign_transaction`）
- [x] `data` 欄位驗證：`0x` prefix + even length + hex-only
- [x] `chainId` 驗證：positive integer
- [x] `sign_permit` 的 `token`/`spender` 欄位驗證：`0x` prefix + 42 char + hex-only
- [x] 驗證失敗回傳 user-friendly error（非 internal exception）
- [x] 共用 schema helpers 可複用（所有 tool 統一使用）

### 5c. CLI evaluator wiring
- [x] CLI 註冊所有已支援 evaluator（目前：erc20 + uniswapV3）
- [x] 新增 CLI 單元測試驗證 evaluator 接線

### 5d. Tool handler dedup
- [x] 提取共用 `executeDecodedCallPipeline` helper（`decoded-call-pipeline.ts`）
- [x] `sign_swap` 與 `sign_defi_call` 改用共用 helper
- [x] 行為不變（相同 audit log 格式、相同 error response）
- [x] 現有測試全部通過

### 5e. PolicyEngine optimization
- [x] Constructor 預處理 allowlists 為 `Set`
- [x] `evaluateBase()` 使用 `Set.has()`
- [x] 現有測試全部通過

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過
- [x] `pnpm build` 成功

## Dependencies

- DeFi MCP Tools (Phase 3) — Done

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Brainstorming completed |
| Development | ✅ Done | All security checks implemented |
| Testing | ✅ Done | Unit + E2E + integration pass |
| Acceptance | ✅ Done | All AC verified |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (Section 8: Security Considerations, Section 9: Phase 5)
- Brainstorming: Claude + Codex adversarial research (Codex thread: `019c5751-9c34-7063-b31a-5a63f89ddb23`)
