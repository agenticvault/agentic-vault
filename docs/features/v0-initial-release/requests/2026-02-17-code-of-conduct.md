# Code of Conduct

> **Created**: 2026-02-17
> **Status**: Pending
> **Priority**: P1
> **Feature**: v0-initial-release
> **Depends on**: None
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm` thread: `019c698c-492d-7d81-bbae-31c9f751ec24`)

## Background

開源準備度評估中，治理面向評分 3/5，主因為缺少 `CODE_OF_CONDUCT.md`。雖非 npm publish 的技術阻擋項，但作為安全敏感的簽章專案，在社群成長前建立行為準則是 P1 優先事項。

Codex 立場：阻擋項。Claude 立場：P2 建議。Nash 均衡：**非阻擋項，但強烈建議在第一個外部 PR 之前完成**。

## Requirements

| # | Item | Description |
|---|------|-------------|
| C1 | `CODE_OF_CONDUCT.md` | 採用 Contributor Covenant v2.1（業界標準） |
| C2 | 聯絡資訊 | 設定 enforcement 聯絡方式（email 或 GitHub form） |
| C3 | CONTRIBUTING.md 引用 | CONTRIBUTING.md 中新增 Code of Conduct 段落連結 |

## Scope

| Scope | Description |
|-------|-------------|
| In | CODE_OF_CONDUCT.md 建立、CONTRIBUTING.md 更新引用 |
| Out | 自訂行為準則（使用業界標準即可）、多語系翻譯（英文為主） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `CODE_OF_CONDUCT.md` | New | Contributor Covenant v2.1 |
| `CONTRIBUTING.md` | Modify | 新增 Code of Conduct 引用 |

## Acceptance Criteria

- [ ] `CODE_OF_CONDUCT.md` 存在且採用 Contributor Covenant v2.1
- [ ] 包含 enforcement 聯絡資訊
- [ ] `CONTRIBUTING.md` 引用 Code of Conduct
- [ ] `/codex-review-doc` 通過

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| C1. CODE_OF_CONDUCT.md | #1 | Low | 治理完整性 |
| C2. 聯絡資訊 | #1 | Low | 含在 C1 中 |
| C3. CONTRIBUTING.md 更新 | #2 | Low | 交叉引用 |

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
- Contributor Covenant: https://www.contributor-covenant.org/version/2/1/code_of_conduct/
