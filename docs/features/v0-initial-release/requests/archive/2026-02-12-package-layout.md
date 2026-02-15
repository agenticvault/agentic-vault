# Minimal Package Layout

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-repo-extraction.md](./2026-02-12-repo-extraction.md)

## Background

建立 `src/agentic/` 目錄及 ESLint restricted-paths 信任邊界，確保 agentic 程式碼僅能透過 public API 存取 signer 功能。

## Requirements

- `src/agentic/` 目錄（空，準備放 skill/plugin 程式碼）
- ESLint restricted-paths 規則：`src/agentic/` 只能 import `src/index.ts`
- 更新 README 反映新架構

## Scope

| Scope | Description |
|-------|-------------|
| In | 目錄結構、ESLint 規則、README 更新 |
| Out | MCP server、實際 agentic 功能 |

## Acceptance Criteria

- [x] `src/agentic/` 目錄已建立
- [x] ESLint restricted-paths 規則強制 `agentic/` 只能 import public API
- [x] `pnpm build` 成功
- [x] `pnpm test` 所有現有測試通過
- [x] README 更新反映新架構

## Dependencies

- Repo Extraction (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | src/agentic/ + ESLint rules |
| Testing | ✅ Done | build + tests pass |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
