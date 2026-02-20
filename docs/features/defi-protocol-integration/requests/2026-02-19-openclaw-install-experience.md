# OpenClaw Plugin Installation Experience

> **Created**: 2026-02-19
> **Status**: In Progress (R1 + R2 Done, R3 Pending)
> **Priority**: P1
> **Feature**: defi-protocol-integration
> **Depends on**: [2026-02-19-openclaw-sdk-alignment.md](./2026-02-19-openclaw-sdk-alignment.md)
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, Codex thread: `019c7677-30ea-73d3-8eb9-357b223ab3b4`)

## Background

實際部署反饋顯示 OpenClaw plugin 安裝體驗極差。使用者需要手動執行多步驟，且現有 Quick Start（`cp -r`）會遺漏 runtime dependency，導致 silent failure。

### 問題分析

| 問題 | 嚴重度 | 說明 |
|------|--------|------|
| Quick Start 遺漏 runtime deps | P0 | `cp -r` 不含 `node_modules`，runtime import `@agenticvault/agentic-vault` 失敗 |
| 無一鍵安裝 | P1 | 最少需 3 步指令，使用者必須理解 OpenClaw extension discovery 機制 |
| `openclaw plugins install` 不可用 | P1 | Upstream bug：installer 從 unscoped name 推導 ID（`openclaw` ≠ `agentic-vault`） |
| 安裝後仍需手動設定 | P2 | 使用者必須自行編輯 `openclaw.json` 加入 `plugins.entries` |

### Root Cause

```
npm package:     @agenticvault/agentic-vault-openclaw
unscoped name:   openclaw          ← OpenClaw installer 使用此值
manifest id:     agentic-vault     ← OpenClaw runtime 使用此值
main package:    @agenticvault/agentic-vault  ← 佔用了理想名稱
```

OpenClaw `plugins install` 從 `unscopedPackageName()` 推導 extension ID，而非從 `openclaw.plugin.json` 的 `id` 欄位。官方 plugin（如 `@openclaw/voice-call`）不受影響，因為 unscoped name = manifest id。

### 競品參考（OpenClaw Docs 研究）

| 生態系 | 安裝指令 | 步驟數 |
|--------|----------|--------|
| OpenClaw 官方 plugin | `openclaw plugins install @openclaw/voice-call` | 1 |
| Claude MCP Server | `claude mcp add name -- npx -y @package` | 1 |
| VS Code Extension | Marketplace 一鍵安裝 | 1 |
| Homebrew | `brew install package` | 1 |
| **我們（目前）** | **3 步指令 + 手動設定** | **4+** |

## Requirements

### R1: Fix Quick Start — 加入 dependency 安裝步驟 (P0)

現有 Quick Start 遺漏 `npm install`，導致 runtime dependency 缺失。

| Item | Description |
|------|-------------|
| 修正 README Quick Start | `cp -r` 後加入 `cd ~/.openclaw/extensions/agentic-vault && npm install --omit=dev --ignore-scripts` |
| 5 份 README 同步 | English + zh-TW + zh-CN + ja + ko |

### R2: Ship `install.ts` — 一鍵安裝腳本 (P1)

嵌入在現有 `@agenticvault/agentic-vault-openclaw` package 中的安裝腳本。

| Item | Description |
|------|-------------|
| 新增 `src/install.ts` | Self-install script：copy → install deps → print config snippet |
| `package.json` 新增 `bin` | `"agentic-vault-setup": "./dist/install.js"` |
| `files` 更新 | 確保 `dist/install.js` 包含在 npm tarball 中 |
| README 更新 | 新增 "One-Command Install" 為首選方式 |

安裝腳本行為：

```
1. Copy plugin files → ~/.openclaw/extensions/agentic-vault-openclaw/
2. Run npm install --omit=dev --ignore-scripts in target dir
3. Print config snippet（不自動修改 user config）
4. Print next steps（設定 keyId, region, restart gateway）
```

一鍵指令：

```bash
npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup
```

### R3: File Upstream OpenClaw Issue (P1)

> **Note**: v0.1.3 計劃透過 [package rename](./2026-02-20-openclaw-package-rename.md) 同時解決此問題（npm name + manifest id 對齊）。Upstream issue 仍建議提交，但不再是唯一解法。

| Item | Description |
|------|-------------|
| Issue 內容 | `openclaw plugins install` 應使用 `openclaw.plugin.json` 的 `id` 而非 `unscopedPackageName()` |
| 附帶 repro | 示範 `@agenticvault/agentic-vault-openclaw` 安裝後 config key 不一致 |
| 提供 patch 建議 | 指向 `install-safe-path` + `installs` 模組中的相關行 |

### R4: `@agenticvault/create` 互動式安裝（Future, P3）

| Item | Description |
|------|-------------|
| 獨立套件 | `npm create @agenticvault` 或 `npx @agenticvault/create` |
| 互動式設定 | 引導使用者設定 AWS KMS key, region, policy file |
| Scope | v0.2+ 使用者基數增長後考慮 |

## Scope

| Scope | Description |
|-------|-------------|
| In | Quick Start 修正（R1）、install.ts + bin entry（R2）、upstream issue（R3）、README 更新、翻譯同步 |
| Out | `@agenticvault/create` 獨立套件（R4, Future）、auto-modify user config、OpenClaw installer upstream fix |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `packages/openclaw-plugin/src/install.ts` | New | 一鍵安裝腳本 |
| `packages/openclaw-plugin/package.json` | Modify | 新增 `bin` entry, 更新 `files` |
| `packages/openclaw-plugin/README.md` | Modify | 新增 "One-Command Install", 修正 Quick Start |
| `packages/openclaw-plugin/README.zh-TW.md` | Modify | 翻譯同步 |
| `packages/openclaw-plugin/README.zh-CN.md` | Modify | 翻譯同步 |
| `packages/openclaw-plugin/README.ja.md` | Modify | 翻譯同步 |
| `packages/openclaw-plugin/README.ko.md` | Modify | 翻譯同步 |
| `packages/openclaw-plugin/test/unit/install.test.ts` | New | 安裝腳本 unit test |

## Acceptance Criteria

### R1: Quick Start 修正
- [x] Quick Start 加入 `npm install --omit=dev --ignore-scripts` 步驟
- [x] 5 份 README（en, zh-TW, zh-CN, ja, ko）同步更新

### R2: install.ts
- [x] `packages/openclaw-plugin/src/install.ts` 實作 self-install 邏輯
- [x] `package.json` 新增 `"bin": { "agentic-vault-setup": "./dist/install.js" }`
- [x] `files` array 包含所有必要檔案（`dist`, `openclaw.plugin.json`, `LICENSE`）
- [ ] `npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup` 可正確安裝（需 npm publish 後驗證）
- [x] 安裝後 `~/.openclaw/extensions/agentic-vault-openclaw/` 包含完整 plugin + deps（含 REQUIRED_ENTRIES 驗證）
- [x] 安裝後印出 config snippet（不自動修改 config）
- [x] README "One-Command Install" section 新增
- [x] 5 份 README 翻譯同步
- [x] `test/unit/install.test.ts` 覆蓋核心邏輯（14 tests）

### R3: Upstream Issue
- [ ] OpenClaw repo 提交 issue：installer ID mismatch
- [ ] Issue 包含 repro steps + 建議 patch

### CI Gates
- [x] `pnpm build` 成功（含 `install.ts` 編譯）
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 通過（698 tests）
- [x] `pnpm --filter @agenticvault/agentic-vault-openclaw test:unit` 通過（53 tests）

## Dependencies

- OpenClaw SDK Alignment (Phase 8.5) — Done
- npm publish `@agenticvault/agentic-vault-openclaw@0.1.2+` — R3 需要已發佈版本

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| install.ts OS/path edge cases | Medium | Unit test 覆蓋 Linux/macOS；Windows 標記 unsupported |
| npm exec bin resolution 行為差異 | Medium | 測試 npm 10+ 和 pnpm 環境 |
| Upstream issue 不被接受 | Low | 現有 workaround（manual install + `plugins.load.paths`）持續有效 |
| `--ignore-scripts` 可能遺漏必要 postinstall | Low | 我們的 deps 無 postinstall；safer default |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium（Claude + Codex + OpenClaw docs 研究） |
| R1: Quick Start fix | Done | 5 份 README 加入 `npm install --omit=dev --ignore-scripts` |
| R2: install.ts | Done | self-install script + bin entry + REQUIRED_ENTRIES 驗證 + 14 unit tests |
| R3: Upstream issue | Pending | Post npm publish |

## References

- Brainstorming: Codex thread `019c7677-30ea-73d3-8eb9-357b223ab3b4`
- OpenClaw Plugins Docs: https://docs.openclaw.ai/plugins
- OpenClaw Voice Call Install: https://docs.openclaw.ai/extensions/voice-call-plugin
- Parent Request: [2026-02-14-openclaw-plugin.md](./2026-02-14-openclaw-plugin.md)
- SDK Alignment: [2026-02-19-openclaw-sdk-alignment.md](./2026-02-19-openclaw-sdk-alignment.md)
- npx Setup Pattern: https://getstream.io/blog/npx-script-project-setup/
