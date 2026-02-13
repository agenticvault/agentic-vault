# Vaultsign Deprecation Shim

> **Created**: 2026-02-12
> **Status**: Pending
> **Priority**: P2
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-monorepo-migration.md](./2026-02-12-monorepo-migration.md)

## Background

發佈 `@sd0xdev/vaultsign` 最終版本，re-export `@sd0xdev/agentic-vault` 並標記 deprecated。維持 1-2 個版本後移除。

## Requirements

- `@sd0xdev/vaultsign` 新版本 re-export 所有 symbols from `@sd0xdev/agentic-vault`
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
- [ ] 所有 symbols re-export 自 `@sd0xdev/agentic-vault`
- [ ] npm deprecation message 已設定
- [ ] README 包含遷移指引

## Dependencies

- Monorepo Migration (Pending)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | |
| Development | Pending | |
| Acceptance | Pending | |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
