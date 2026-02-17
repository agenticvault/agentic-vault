# Multilingual README Expansion

> **Created**: 2026-02-16
> **Status**: Done
> **Priority**: P1
> **Feature**: v0-initial-release
> **Depends on**: [2026-02-16-readme-restructure-i18n.md](./2026-02-16-readme-restructure-i18n.md) (Done)
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm` thread: `019c696f-fa38-7452-bdff-3fda9b8fb2ed`)

## Background

v0.1.0 已完成 README 重構（361->159 行）與繁中翻譯（`README.zh-TW.md`）。Brainstorm 結論：Asia 已超越 North America 成為 #1 crypto 開發者區域（32% vs 24%），應優先覆蓋 zh-CN/ja/ko 以最大化開發者觸及率。

此外 `packages/openclaw-plugin/README.md`（62 行）也需多語系支援，且主專案 README 的 Documentation 表格應明確連結 OpenClaw 插件。

## Requirements

### Part 1: 主專案多語系擴充

| # | Item | Description |
|---|------|-------------|
| L1 | `README.zh-CN.md` | 從 zh-TW 改寫為简体中文（大陸慣用詞彙），非純 sed 轉換 |
| L2 | `README.ja.md` | 日本語翻譯（敬体：です・ます） |
| L3 | `README.ko.md` | 한국어 翻譯（존댓말） |
| L4 | Language selector 更新 | 所有 README 檔案的 selector 同步更新為 5 語言 |
| L5 | Frontmatter | 每個翻譯檔加 `<!-- Source: README.md | Commit: {hash} | Last synced: {date} -->` |

### Part 2: OpenClaw 插件多語系

| # | Item | Description |
|---|------|-------------|
| O1 | `packages/openclaw-plugin/README.zh-TW.md` | 繁中翻譯 |
| O2 | `packages/openclaw-plugin/README.zh-CN.md` | 简中翻譯 |
| O3 | `packages/openclaw-plugin/README.ja.md` | 日本語翻譯 |
| O4 | `packages/openclaw-plugin/README.ko.md` | 한국어翻譯 |
| O5 | 插件 README Language selector | 所有插件 README 加語言選擇器 |

### Part 3: 主專案 README 插件引用

| # | Item | Description |
|---|------|-------------|
| P1 | README.md Documentation 表格 | 確認 OpenClaw Plugin 連結正確指向 `packages/openclaw-plugin/` |
| P2 | README.zh-TW.md 同步 | 確認繁中版也有 OpenClaw 插件連結 |
| P3 | 新翻譯版同步 | zh-CN/ja/ko 版也包含 OpenClaw 插件連結 |

## Scope

| Scope | Description |
|-------|-------------|
| In | zh-CN/ja/ko 翻譯（主專案 + OpenClaw 插件）、language selector 更新、frontmatter |
| Out | es 翻譯（P3 stretch，v0.1.1）、hi/ar/fr/pt-BR（community issue）、docs/ 翻譯、CI stale check |

## Language Tier Strategy

| Tier | Languages | Owner | Timeline |
|------|-----------|-------|----------|
| Core (ship now) | en, zh-TW, zh-CN, ja, ko | Maintainer | This request |
| Stretch | es | Maintainer | v0.1.1 or community PR |
| Community | hi, ar, fr, pt-BR | Community contributor | Open issue |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `README.zh-CN.md` | New | 简中翻譯（~160 行） |
| `README.ja.md` | New | 日本語翻譯（~160 行） |
| `README.ko.md` | New | 한국어翻譯（~160 行） |
| `README.md` | Modify | Language selector 更新 |
| `README.zh-TW.md` | Modify | Language selector 更新 |
| `packages/openclaw-plugin/README.md` | Modify | Language selector 新增 |
| `packages/openclaw-plugin/README.zh-TW.md` | New | 插件繁中翻譯（~62 行） |
| `packages/openclaw-plugin/README.zh-CN.md` | New | 插件简中翻譯（~62 行） |
| `packages/openclaw-plugin/README.ja.md` | New | 插件日本語翻譯（~62 行） |
| `packages/openclaw-plugin/README.ko.md` | New | 插件한국어翻譯（~62 行） |

## Acceptance Criteria

### Part 1: 主專案多語系
- [x] `README.zh-CN.md` 存在且使用大陸慣用詞彙（程序、数据库），非繁體混用
- [x] `README.ja.md` 存在且使用敬体（です・ます）
- [x] `README.ko.md` 存在且使用 존댓말
- [x] 所有翻譯檔包含 frontmatter（source commit + last synced date）
- [x] 所有 5 個主專案 README 的 language selector 一致：`English | 繁體中文 | 简体中文 | 日本語 | 한국어`
- [x] Code blocks 保留 English 不翻譯
- [x] 技術術語保留 English（API, Git, CI/CD, MCP, AWS KMS, CLI, HSM, EVM, DeFi）
- [x] 所有翻譯版的內部連結指向正確的 docs/ 路徑

### Part 2: OpenClaw 插件多語系
- [x] `packages/openclaw-plugin/README.zh-TW.md` 存在
- [x] `packages/openclaw-plugin/README.zh-CN.md` 存在
- [x] `packages/openclaw-plugin/README.ja.md` 存在
- [x] `packages/openclaw-plugin/README.ko.md` 存在
- [x] 所有插件 README 的 language selector 一致
- [x] 插件翻譯檔包含 frontmatter

### Part 3: 主專案 README 插件引用
- [x] 主專案 README Documentation 表格包含 `[OpenClaw Plugin](packages/openclaw-plugin/)` 連結
- [x] 所有翻譯版（zh-TW/zh-CN/ja/ko）也包含對應連結

### Quality Gates
- [x] 無斷鏈（所有內部連結有效）
- [x] Selector guardrail：只連結已存在的檔案
- [x] `/codex-review-doc` 通過

## Translation Quality Rules

| Language | Convention | Source |
|----------|-----------|--------|
| zh-TW | 繁體中文、台灣慣用詞彙（資料庫、程式、函式庫） | `.claude/rules/docs-writing.md` |
| zh-CN | 简体中文、大陆惯用词汇（数据库、程序、函数库） | `.claude/rules/docs-writing.md` |
| ja | 日本語の自然な表現、敬体（です・ます） | `.claude/rules/docs-writing.md` |
| ko | 한국어 자연스러운 표현, 존댓말 | `.claude/rules/docs-writing.md` |

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| L1. zh-CN（從 zh-TW 改寫） | #1 co-P1 | Low | 最大觸及 + 最低成本 |
| L2. ja 翻譯 | #2 co-P1 | Medium | 解鎖全新受眾 |
| L3. ko 翻譯 | #3 P2 | Medium | 韓國 DeFi 活躍 |
| O1-O5. 插件翻譯 | #4 | Medium | 與主專案一致 |
| L4-L5 + P1-P3. Selector + 連結 | #5 | Low | 導航一致性 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium（zh-CN + ja co-P1 共識） |
| Development | Done | 7 new translation files + 3 modified (selector/anchor updates) |
| Testing | Done | `/codex-review-doc` passed (thread: `019c697b-7bae-7393-a7d8-3426e16534ac`) |
| Acceptance | Done | 21/21 AC checked |

## References

- Brainstorming: `/codex-brainstorm` multilingual README session (Codex thread: `019c696f-fa38-7452-bdff-3fda9b8fb2ed`)
- README Restructure: [2026-02-16-readme-restructure-i18n.md](./2026-02-16-readme-restructure-i18n.md)
- v0.1.0 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
- Locale rules: `.claude/rules/docs-writing.md`
- Electric Capital Developer Report: Asia #1 for crypto developers (32% share)
