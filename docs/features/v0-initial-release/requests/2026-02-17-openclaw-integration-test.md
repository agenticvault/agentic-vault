# OpenClaw Plugin Integration Test

> **Created**: 2026-02-17
> **Status**: Done
> **Priority**: P2
> **Feature**: v0-initial-release
> **Depends on**: None
> **Target**: v0.1.1
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm` thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)

## Background

OpenClaw 插件目前有 3 個單元測試檔案（`tools.test.ts`、`trust-boundary.test.ts`、`context.test.ts`），涵蓋工具註冊、信任邊界、設定解析。但缺少 host-level 整合冒煙測試，無法驗證插件在 OpenClaw runtime 中的端對端行為。

Codex 評估：插件品質 4/5，gap 為「only unit-level plugin tests; no host-level integration test in CI」。

## Requirements

| # | Item | Description |
|---|------|-------------|
| T1 | 插件載入冒煙測試 | 驗證 OpenClaw host 能正確載入插件、註冊工具 |
| T2 | 工具呼叫整合測試 | 驗證 `vault_get_address`、`vault_health_check` 工具端對端流程（使用 mock signer） |
| T3 | 雙重閘控測試 | 驗證 `enableUnsafeRawSign: false` 時 raw signing 工具不被註冊 |
| T4 | CI 整合 | 整合測試加入 `openclaw-ci.yml` 工作流程 |

## Scope

| Scope | Description |
|-------|-------------|
| In | 插件載入、工具註冊、安全工具呼叫（mock signer）、雙重閘控驗證 |
| Out | 真實 AWS KMS 簽署（屬 e2e）、OpenClaw marketplace 整合、效能測試 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `packages/openclaw-plugin/test/integration/plugin-load.test.ts` | New | 插件載入冒煙測試 |
| `packages/openclaw-plugin/test/integration/tool-pipeline.test.ts` | New | 工具呼叫整合測試 |
| `.github/workflows/openclaw-ci.yml` | Modify | 新增整合測試步驟 |
| `packages/openclaw-plugin/package.json` | Modify | 調整 `test:unit` 為 `vitest run test/unit/`，新增 `test:integration` 為 `vitest run test/integration/` |

## Acceptance Criteria

- [ ] 插件載入測試通過：OpenClaw host 正確載入插件並註冊 4 個安全工具
- [ ] `vault_get_address` 整合測試通過（mock signer 回傳預期地址）
- [ ] `vault_health_check` 整合測試通過（mock signer 回傳健康狀態）
- [ ] 雙重閘控測試通過：`enableUnsafeRawSign: false` 時僅註冊 4 個工具，`true` 時註冊 6 個
- [ ] `openclaw-ci.yml` 包含整合測試步驟
- [ ] 現有單元測試遷移至 `test/unit/` 子目錄，`test:unit` script 對應更新
- [ ] 現有單元測試全數通過（3 個測試檔案）
- [ ] `/codex-review-fast` 通過
- [ ] `/precommit` 通過

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| T1. 插件載入冒煙測試 | #1 | Medium | 基礎驗證 |
| T3. 雙重閘控測試 | #2 | Low | 安全關鍵 |
| T2. 工具呼叫整合測試 | #3 | Medium | 端對端信心 |
| T4. CI 整合 | #4 | Low | 持續驗證 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium |
| Development | Done | plugin-load.test.ts + tool-pipeline.test.ts |
| Testing | Done | Integration tests pass |
| Acceptance | Done | All AC verified |

## References

- Brainstorming: `/codex-brainstorm` open-source readiness audit (Codex thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)
- Open-Source Readiness: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md)
- OpenClaw Plugin: [packages/openclaw-plugin/](../../../../packages/openclaw-plugin/)
- Existing tests: `packages/openclaw-plugin/test/tools.test.ts`, `trust-boundary.test.ts`, `context.test.ts`
