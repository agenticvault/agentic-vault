# OpenClaw Plugin Exports Map

> **Created**: 2026-02-17
> **Status**: Pending
> **Priority**: P3
> **Feature**: v0-initial-release
> **Depends on**: None
> **Target**: 當插件新增多個進入點時
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm` thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)

## Background

Codex 建議在 `packages/openclaw-plugin/package.json` 新增明確的 `exports` 映射，以控制套件暴露面。Claude 認為目前單一進入點（`index.ts`）不需要 exports 映射，`main` + `types` 已足夠。

Nash 均衡：**v0.1.0 不需要**。僅在插件新增多個進入點（如 `@agenticvault/openclaw/testing`、`@agenticvault/openclaw/types`）時才有實質價值。

## Requirements

| # | Item | Description |
|---|------|-------------|
| E1 | `exports` 映射 | 在 `packages/openclaw-plugin/package.json` 新增 `exports` 欄位 |
| E2 | 子路徑規劃 | 評估是否需要 `/testing`、`/types` 等子路徑 |
| E3 | 向後相容 | 確保 `main` + `types` 仍作為 fallback |

## Scope

| Scope | Description |
|-------|-------------|
| In | package.json exports 映射、子路徑評估 |
| Out | 新增實際子路徑模組（屬功能開發）、主套件 exports 變更 |

## Trigger Condition

此需求單為**條件式**，僅在以下情況觸發：

- 插件新增第二個進入點（如 testing utilities）
- 使用者回報 bundler 相容性問題
- 主套件 exports 模式需要對齊

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `packages/openclaw-plugin/package.json` | Modify | 新增 `exports` 欄位 |

## Acceptance Criteria

- [ ] `packages/openclaw-plugin/package.json` 包含 `exports` 映射
- [ ] `exports` 涵蓋所有公開進入點
- [ ] `main` + `types` 仍存在（向後相容）
- [ ] 現有 import 路徑不受影響
- [ ] `/codex-review-fast` 通過

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium — 目前不需要 |
| Development | Pending | 等待觸發條件 |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Brainstorming: `/codex-brainstorm` open-source readiness audit (Codex thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)
- Open-Source Readiness: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md)
- 主套件 exports 參考: `package.json` `.` / `./protocols` / `./agentic` 三路徑模式
