# Vaultsign Deprecation Shim

> **Created**: 2026-02-12
> **Status**: Deferred
> **Priority**: P2
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-monorepo-migration.md](./2026-02-12-monorepo-migration.md)

## Background

發佈 `@sd0xdev/vaultsign` 最終版本，re-export `@agenticvault/agentic-vault` 並標記 deprecated。維持 1-2 個版本後移除。

## Requirements

- `@sd0xdev/vaultsign` 新版本 re-export 所有 symbols from `@agenticvault/agentic-vault`
- `package.json` 加入 `"deprecated"` 欄位
- README 加入棄用通知 + 遷移指引
- npm 發佈帶 deprecation message

## Scope

| Scope | Description |
|-------|-------------|
| In | Shim 發佈、棄用通知 |
| Out | 移除 shim（日後處理） |

## Acceptance Criteria

- [ ] `@sd0xdev/vaultsign` 新版本發佈
- [ ] 所有 symbols re-export 自 `@agenticvault/agentic-vault`
- [ ] npm deprecation message 已設定
- [ ] README 包含遷移指引

## Dependencies

- Monorepo Migration (Deferred)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | |
| Development | Deferred | Blocked by monorepo migration（已 deferred） |
| Acceptance | Deferred | — |

> **Deferred reason**: 依賴 monorepo migration（已 deferred）。待上游完成後處理。

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
