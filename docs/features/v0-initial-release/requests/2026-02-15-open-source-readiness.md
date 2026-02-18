# Open-Source Readiness

> **Created**: 2026-02-15
> **Status**: Done
> **Priority**: P0
> **Feature**: v0-initial-release
> **Depends on**: All Phase 1-8 requests (Done)
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm`)

## Background

Phase 1-8 開發完成（529 + 33 unit tests pass, zero lint/typecheck/build errors, zero dependency vulnerabilities）。程式碼品質已達開源標準，但治理、打包、文件面向仍有缺口。

Brainstorming 識別 3 個阻擋項 + 6 個應修復項 + 3 個可選項。

## Requirements

### Blockers（必須在 npm publish 前完成）

| # | Item | Description |
|---|------|-------------|
| B1 | `.claude-plugin` 打包不一致 | `.claude-plugin` 列在 `package.json` `files` 陣列但被 `.gitignore` 排除，CI publish 不會包含此目錄。需追蹤必要檔案或從 `files` 移除 |
| B2 | `SECURITY.md` | KMS 簽署專案需要漏洞揭露政策（通報管道、SLA、嚴重程度分級、支援版本） |
| B3 | 提交所有變更 | Phase 2-8 工作尚未提交（含程式碼、文件、設定檔） |

### Should Fix（v0.1.0 tag 前完成）

| # | Item | Description |
|---|------|-------------|
| S1 | `CHANGELOG.md` | 僅涵蓋初始骨架，缺少 Phase 2-8（DeFi decoder、Policy V2、Workflow、CLI、OpenClaw plugin） |
| S2 | `package.json` description | 仍為「Agentic Vault Wallet — server-side EVM signing with pluggable providers and agentic capabilities」，需對齊 README |
| S3 | `package.json` keywords | 缺少 `defi`、`uniswap`、`aave`、`openclaw`、`protocol-decoder`、`policy-engine` |
| S4 | `packages/openclaw-plugin/README.md` | Plugin 套件缺少 README（npm 發佈需要） |
| S5 | `CONTRIBUTING.md` | README 有 Contributing 段落但無獨立檔案 |
| S6 | `.github/` PR/issue templates | 缺少 issue template 和 PR template |

### Nice-to-Have（可於發佈後新增）

| # | Item | Description |
|---|------|-------------|
| N1 | `CODE_OF_CONDUCT.md` | Contributor Covenant |
| N2 | `package.json` metadata | `bugs`、`homepage`、`funding` 欄位 |
| N3 | Security scanning workflow | CodeQL 或 dependency review |

## Scope

| Scope | Description |
|-------|-------------|
| In | 治理文件（SECURITY、CONTRIBUTING）、打包修復、CHANGELOG 更新、package.json 修正、plugin README、GitHub templates |
| Out | 程式碼功能變更、新 protocol 支援、npm publish 本身（屬 v1-release） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `SECURITY.md` | New | 漏洞揭露政策 |
| `CONTRIBUTING.md` | New | 貢獻指南（從 README Contributing 段落擴展） |
| `CHANGELOG.md` | Modify | 新增 Phase 2-8 內容 |
| `package.json` | Modify | description、keywords 更新 |
| `packages/openclaw-plugin/README.md` | New | Plugin 使用說明 |
| `.github/ISSUE_TEMPLATE/bug_report.md` | New | Bug report template |
| `.github/ISSUE_TEMPLATE/feature_request.md` | New | Feature request template |
| `.github/PULL_REQUEST_TEMPLATE.md` | New | PR template |

## Acceptance Criteria

### Blockers
- [x] `.claude-plugin` 從 `.gitignore` 移除，`plugin.json` 納入 git 追蹤
- [x] `SECURITY.md` 建立，包含通報管道與 SLA
- [ ] 所有 Phase 2-8 變更已提交至 git

### Should Fix
- [x] `CHANGELOG.md` 涵蓋 Phase 1-8 所有功能（Keep a Changelog 格式）
- [x] `package.json` description 對齊 README
- [x] `package.json` keywords 補齊 DeFi/OpenClaw 相關詞（+6 keywords）
- [x] `packages/openclaw-plugin/README.md` 建立
- [x] `CONTRIBUTING.md` 建立
- [x] `.github/` PR + issue templates 建立（bug report / feature request / PR checklist）

### Brainstorm 額外發現（已修復）
- [x] `packages/openclaw-plugin/package.json` 新增 `prepack` 腳本
- [x] `packages/openclaw-plugin/package.json` 新增 `bugs` / `homepage` 欄位
- [x] `package.json` files 排除 `dist/.tsbuildinfo`
- [x] `.github/workflows/release-openclaw.yml` 新增 `typecheck` + `lint` 步驟

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm lint` 通過
- [x] `pnpm test:unit` 通過（529 tests，含 release script 59 tests）
- [x] `pnpm --filter @agenticvault/openclaw test:unit` 通過（33 tests）
- [x] `pnpm build` 成功

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| B1. 打包修復 | #1 | Low | 阻擋項 |
| B2. SECURITY.md | #2 | Low | 阻擋項 |
| S2-S3. package.json | #3 | Low | 應修復 |
| S1. CHANGELOG | #4 | Medium | 應修復 |
| S4. Plugin README | #5 | Low | 應修復 |
| S5. CONTRIBUTING.md | #6 | Low | 應修復 |
| S6. GitHub templates | #7 | Low | 應修復 |
| B3. 提交變更 | #8 | Low | 阻擋項（最後執行） |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium |
| Development | Done | 所有 Blockers + Should Fix + 額外發現已實作 |
| Testing | Done | CI gates 全數通過（typecheck / lint / 529+33 tests / build） |
| Acceptance | Done | v0.1.0 已發佈，所有開源準備工作完成 |

## References

- Brainstorming: `/codex-brainstorm` open-source readiness session
- v1 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
- OpenClaw Plugin: [../../../features/defi-protocol-integration/requests/2026-02-14-openclaw-plugin.md](../../defi-protocol-integration/requests/2026-02-14-openclaw-plugin.md)
