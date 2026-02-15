# Onboarding Improvements (Phase 9)

> **Created**: 2026-02-14
> **Status**: Done
> **Priority**: P1
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 9)
> **Source**: OpenClaw + 安裝友善度 brainstorming Nash Equilibrium (Claude + Codex, 2026-02-14)

## Background

目前安裝和使用 agentic-vault 需要手動傳入多個 flags（`--key-id`, `--region`），且缺少 policy 範例和環境變數範本。這增加了新使用者的上手門檻，也影響 OpenClaw plugin 整合的使用者體驗。

Brainstorm 共識：先完成 onboarding 基礎建設（Sprint 1 中優先處理），再推進 OpenClaw plugin 開發。

## Requirements

### 9a. Environment Variable Fallback

| Item | Description |
|------|-------------|
| 環境變數 | `VAULT_KEY_ID` / `VAULT_REGION` |
| 優先順序 | CLI flags > 環境變數 > 報錯 |
| 影響範圍 | `src/agentic/cli.ts`、`src/cli/context.ts` |
| 測試 | Unit test 驗證三層 fallback 行為 |

### 9b. `.mcp.json` 修復

| Item | Description |
|------|-------------|
| 問題 | `.mcp.json.example` 使用 `npx` 但套件未發布 |
| 修復 | 確保 npm publish 後 `npx -p @agenticvault/agentic-vault agentic-vault-mcp` 可直接使用 |
| 驗證 | npm publish 前需確認 `bin` entry 正確 |

### 9c. Policy Template

| Item | Description |
|------|-------------|
| 新檔案 | `policy.example.json` |
| 內容 | 典型 DeFi policy 設定（chain allowlist, contract allowlist, protocol policies） |
| 用途 | 使用者可直接複製並修改 |

### 9d. `.env.example`

| Item | Description |
|------|-------------|
| 新檔案 | `.env.example` |
| 內容 | 所有支援的環境變數及說明 |
| 注意 | 不含實際 secrets |

## Scope

| Scope | Description |
|-------|-------------|
| In | Env var fallback、`.mcp.json` 修復、policy template、`.env.example` |
| Out | `agentic-vault init` 命令（deferred）、Node 版本升級（維持 22） |

## Acceptance Criteria

### 9a. Environment Variable Fallback
- [x] `VAULT_KEY_ID` 可替代 `--key-id` flag
- [x] `VAULT_REGION` 可替代 `--region` flag
- [x] CLI flag 優先於環境變數
- [x] 兩者皆無時顯示清楚的錯誤訊息
- [x] Unit test 覆蓋三層 fallback

### 9b. `.mcp.json` 修復
- [x] `npx -p @agenticvault/agentic-vault agentic-vault-mcp` 可正常啟動 MCP server
- [x] `.mcp.json.example` 使用正確的指令格式

### 9c. Policy Template
- [x] `policy.example.json` 包含 chain allowlist、contract allowlist、protocol policies 範例
- [x] 範例可直接用於 `--policy-config` 參數
- N/A 包含註解說明各欄位用途（JSON 不支援註解，欄位名稱已自描述）

### 9d. `.env.example`
- [x] 列出 `VAULT_KEY_ID`、`VAULT_REGION`、`SEPOLIA_RPC_URL` 等環境變數
- [x] 每個變數附有說明
- [x] 不含實際 secrets

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過（467 tests）
- [x] `pnpm build` 成功

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `src/agentic/cli.ts` | Modify | 新增 env var fallback |
| `src/cli/context.ts` | Modify | CLI context 新增 env var 解析 |
| `.mcp.json.example` | Modify | 修復指令格式 |
| `policy.example.json` | New | Policy 設定範例 |
| `.env.example` | New | 環境變數範本 |
| `test/unit/agentic/cli.test.ts` | Modify | Env var fallback 測試 |
| `test/unit/cli/context.test.ts` | Modify | Context env var 測試 |
| `package.json` | Modify | `files` array 修正 + 加入範例檔 |
| `src/cli/index.ts` | Modify | CLI help text 更新 env var 說明 |

## Dependencies

- Phase 4 (Aave V3) -- Done
- Phase 6 (Multi-Interface Architecture) -- Done

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Brainstorming Nash Equilibrium reached |
| Development | ✅ Done | Env var fallback, .mcp.json fix, templates |
| Testing | ✅ Done | 12 new tests (6 cli + 6 context), 467 total pass |
| Acceptance | ✅ Done | 15/16 AC met, 1 N/A (JSON no comments) |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (Phase 9)
- Brainstorming: OpenClaw + onboarding (2026-02-14)
