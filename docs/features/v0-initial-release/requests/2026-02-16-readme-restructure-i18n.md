# README Restructure + Multi-Language Support

> **Created**: 2026-02-16
> **Status**: Pending
> **Priority**: P0
> **Feature**: v0-initial-release
> **Depends on**: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md) (Done)
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm`)

## Background

目前 README.md（361 行）技術資訊完整，但定位偏向「單檔 reference manual」而非「decision + navigation hub」。對 evaluator 缺少 "Why" 段落，對 integrator 細節過多（Choose Your Interface 佔 127 行），Contributing 與 CONTRIBUTING.md 重複。

Brainstorming Nash Equilibrium 達成共識：瘦身至 ~180 行 + 抽離 4 個獨立文件 + 新增 "Why" 段落 + 多語系支援（zh-TW 優先）。

## Requirements

### Part 1: README 重構

| # | Item | Description |
|---|------|-------------|
| R1 | 新增 "Why Agentic Vault" | 問題定義 + 市場空白 + 差異化（~8 行，從 brainstorm 萃取） |
| R2 | 新增 Language selector | Badges 下方，連結至各語言版本 |
| R3 | 精簡 Quick Start | 單一路徑 + No-AWS dry-run demo（`decode`/`dry-run` 無需 AWS） |
| R4 | Interface matrix | 詳細命令抽離，README 只放表格 + 深連結 |
| R5 | 精簡 Configuration | 移除完整 JSON + schema table，連結到 `policy.example.json` + reference doc |
| R6 | 精簡 AWS KMS Setup | 抽離至獨立 guide |
| R7 | 精簡 Contributing | 僅保留一行連結到 `CONTRIBUTING.md` |
| R8 | 新增 Docs Index | 連結到 architecture、guides、reference |
| R9 | 新增 Roadmap | 3-5 bullet points 未來方向 |

### Part 2: 文件抽離

| # | 來源 | 目標 | Description |
|---|------|------|-------------|
| D1 | Choose Your Interface 詳細命令 | `docs/guides/interfaces.md` | 4 種介面完整使用說明 |
| D2 | Policy Config JSON + schema | `docs/reference/policy.md` | 完整 policy 設定參考 |
| D3 | AWS KMS Setup + IAM | `docs/guides/aws-kms-setup.md` | KMS key 建立 + IAM 權限 |

### Part 3: 多語系

| # | Item | Description |
|---|------|-------------|
| I1 | `README.zh-TW.md` | 繁中 landing（翻譯精簡版 README） |
| I2 | Language selector banner | 各版本互相引用 |
| I3 | Frontmatter 規格 | `<!-- Source: README.md | Commit: {hash} | Last synced: {date} -->` |

## Scope

| Scope | Description |
|-------|-------------|
| In | README 重構、文件抽離、繁中翻譯、language selector |
| Out | zh-CN/ja/ko 翻譯（社群驅動）、CI stale check（v0.1.1+）、完整 docs site |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `README.md` | Modify | 瘦身 361→~180 行 |
| `README.zh-TW.md` | New | 繁中 landing |
| `docs/guides/interfaces.md` | New | 4 種介面完整使用說明 |
| `docs/reference/policy.md` | New | Policy 設定參考 |
| `docs/guides/aws-kms-setup.md` | New | KMS 設定 guide |

## Acceptance Criteria

### Part 1: README 重構
- [ ] README.md 行數 ≤ 220 行
- [ ] "Why Agentic Vault" 段落存在（問題 + 市場空白 + 差異化）
- [ ] Language selector banner 存在（badges 下方）
- [ ] No-AWS Quick Demo 存在（`decode` 或 `dry-run`）
- [ ] Interface section 為 matrix table + 深連結（非完整命令列表）
- [ ] Configuration section 為連結（非完整 JSON）
- [ ] AWS KMS Setup 為連結（非完整 IAM 範例）
- [ ] Contributing section 為一行連結
- [ ] Docs Index 段落存在
- [ ] Roadmap 段落存在（3-5 items）

### Part 2: 文件抽離
- [ ] `docs/guides/interfaces.md` 包含 Library/CLI/MCP/OpenClaw 完整說明
- [ ] `docs/reference/policy.md` 包含完整 JSON + schema table
- [ ] `docs/guides/aws-kms-setup.md` 包含 key creation + IAM policy

### Part 3: 多語系
- [ ] `README.zh-TW.md` 存在且包含 frontmatter（source commit）
- [ ] 所有語言版本 language selector 互相引用
- [ ] Code blocks 保留 English

### CI Gates
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm lint` 通過
- [ ] `pnpm test:unit` 通過
- [ ] `pnpm build` 成功
- [ ] 無斷鏈（README 內部連結全部有效）

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| R1. "Why" 段落 | #1 | Low | 最大缺口 |
| D1-D3. 文件抽離 | #2 | Medium | README 瘦身前提 |
| R2-R9. README 重構 | #3 | Medium | 核心交付 |
| I1-I3. 繁中翻譯 | #4 | Medium | 多語系 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Brainstorming: `/codex-brainstorm` README restructure session (Codex thread: `019c6402-76ed-7ea1-a7fa-3f61e25b3424`)
- v0.1.0 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
- Open-Source Readiness: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md)
- 參考 OSS 模式：viem（入口型 README）、Prisma（Why + Quickstart 前置）、ethers.js（精簡導航）
