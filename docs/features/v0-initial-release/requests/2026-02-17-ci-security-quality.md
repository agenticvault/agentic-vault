# CI Security & Quality Automation

> **Created**: 2026-02-17
> **Status**: Pending
> **Priority**: P2
> **Feature**: v0-initial-release
> **Depends on**: None
> **Target**: v0.1.1
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm` thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)

## Background

開源準備度評估中，CI/CD 與安全態勢各得 4/5。現有人工安全措施完善（SECURITY.md、ESLint 信任邊界、deny-by-default），但缺少自動化安全掃描與測試覆蓋率報告。

Claude + Codex 共識：v0.1.0 人工態勢足以支撐初次發佈，v0.1.1 應補齊自動化。

## Requirements

| # | Item | Description |
|---|------|-------------|
| S1 | CodeQL workflow | GitHub CodeQL 分析，涵蓋 TypeScript/JavaScript |
| S2 | Dependency review | PR 觸發的依賴漏洞檢查（`actions/dependency-review-action`） |
| S3 | Secret scanning | 啟用 GitHub secret scanning（repo 設定，非程式碼變更；public repo 自動啟用） |
| S4 | Coverage reporting | 單元測試覆蓋率報告整合至 CI（如 Vitest coverage + threshold） |
| S5 | Coverage badge | README 新增覆蓋率徽章 |

## Scope

| Scope | Description |
|-------|-------------|
| In | CodeQL、dependency review、secret scanning（repo 設定）、coverage reporting、coverage badge |
| Out | SAST 付費工具（Snyk、SonarCloud）、runtime 安全監控、penetration testing |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/codeql.yml` | New | CodeQL 分析 + dependency review 工作流程 |
| `.github/workflows/ci.yml` | Modify | 新增 coverage 報告步驟 |
| GitHub repo settings | Configure | 啟用 secret scanning（非程式碼變更） |
| `vitest.config.ts` | Modify or New | 新增 coverage 設定（threshold） |
| `package.json` | Modify | 新增 `test:coverage` script |
| `README.md` | Modify | 新增 coverage badge |

## Acceptance Criteria

### Security Scanning
- [ ] `.github/workflows/codeql.yml` 建立，每次 push/PR 及每週排程觸發
- [ ] CodeQL 涵蓋 `javascript` 語言（含 TypeScript）
- [ ] Dependency review action 在 PR 中執行
- [ ] Secret scanning 已啟用（repo 設定，非程式碼變更；public repo 預設啟用，需確認）

### Coverage Reporting
- [ ] CI 產出覆蓋率報告
- [ ] 設定最低覆蓋率門檻（建議 lines 80%、branches 70%）
- [ ] README 新增覆蓋率徽章
- [ ] `pnpm test:coverage` script 可用

### Quality Gates
- [ ] 現有 CI 不受影響（typecheck / lint / unit tests 仍通過）
- [ ] `/codex-review-fast` 通過
- [ ] `/precommit` 通過

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| S1. CodeQL workflow | #1 | Low | 自動漏洞偵測 |
| S2. Dependency review | #2 | Low | PR 依賴審查 |
| S4. Coverage reporting | #3 | Medium | 品質可見性 |
| S5. Coverage badge | #4 | Low | 專案信譽 |
| S3. Secret scanning | #5 | Low | 通常自動啟用 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Brainstorming: `/codex-brainstorm` open-source readiness audit (Codex thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)
- Open-Source Readiness: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md)
- GitHub CodeQL: https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning
- Vitest Coverage: https://vitest.dev/guide/coverage
