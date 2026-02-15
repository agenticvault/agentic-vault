# Repo Extraction

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P0
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)

## Background

從 monorepo `packages/vaultsign/` 複製程式碼至新的獨立 repo `agenticvault/agentic-vault`，更新 package.json 及專案設定。

## Requirements

- 建立新專案目錄 `/Users/yuhao/Project/agentic-vault-wallet/`
- 複製 `src/`、`test/`、`LICENSE` 等核心檔案
- 更新 `package.json`（name → `@agenticvault/agentic-vault`、repository、keywords）
- 修正 `tsconfig.json`（移除 monorepo extends）
- 修正 `vitest.config.ts`（移除 monorepo .env 路徑）
- 初始化 git repo
- 安裝依賴

## Scope

| Scope | Description |
|-------|-------------|
| In | 專案複製、設定更新、依賴安裝 |
| Out | 新功能開發、MCP server、GitHub repo 建立 |

## Acceptance Criteria

- [x] 新專案目錄已建立
- [x] 核心原始碼已複製（5 source files）
- [x] `package.json` name 改為 `@agenticvault/agentic-vault`
- [x] `tsconfig.json` 已修正為獨立設定
- [x] `vitest.config.ts` 已修正為獨立設定
- [x] `pnpm install` 成功
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過（60 tests）
- [x] git repo 已初始化

## Dependencies

- None

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | Files copied, configs updated |
| Testing | ✅ Done | typecheck + 60 unit tests passed |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
