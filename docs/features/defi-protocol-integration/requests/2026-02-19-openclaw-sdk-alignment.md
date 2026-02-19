# OpenClaw SDK Alignment (Phase 8.5)

> **Created**: 2026-02-19
> **Status**: Done
> **Priority**: P0
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 8.5)
> **Depends on**: [2026-02-14-openclaw-plugin.md](./2026-02-14-openclaw-plugin.md) (Phase 8)
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, Codex threads: `019c75c1-a57f-77f1-af6a-8922b6bcdde1`, `019c75ca-db6e-7450-a2d5-f69a941a511d`)

## Background

Phase 8 建立的 OpenClaw plugin 使用自定義 API（`register(api, config)` + 3-arg `registerTool`），與 `openclaw/plugin-sdk` 官方合約不一致。OpenClaw gateway 無法發現或載入此 plugin。

Phase 8.5 將 plugin 遷移至官方合約（`export default function(api)` + AgentTool object format），並解決安裝路徑問題。

### API Contract Diff

| Aspect | Phase 8 (Wrong) | Phase 8.5 (Official) |
|--------|-----------------|---------------------|
| Entry point | `export function register(api, config)` | `export default function(api)` |
| Config access | 2nd arg to `register` | `api.pluginConfig` |
| registerTool | `api.registerTool(name, config, handler)` 3-arg | `api.registerTool(toolObj, opts?)` single object |
| Tool shape | Custom | `{ name, description, parameters, label, execute }` AgentTool |
| execute sig | `async (args) => result` | `async execute(toolCallId, params) => result` |
| Parameters | Flat `Record<string, {type, required}>` | JSON Schema `{ type:'object', properties, required }` |
| API types | Self-defined | `import type { OpenClawPluginApi } from 'openclaw/plugin-sdk'` |
| Manifest | `{ "name": "..." }` | `{ "id": "..." }` + JSON Schema configSchema |
| package.json | No `openclaw` field | `"openclaw": { "extensions": ["./dist/index.js"] }` |

### 已知安裝限制（Brainstorm 發現）

| 問題 | 嚴重度 | 說明 |
|------|--------|------|
| Installer ID mismatch | P1 | `openclaw plugins install @agenticvault/openclaw` → unscopedName = `openclaw` ≠ manifest `id: "agentic-vault"` → config key mismatch |
| Peer dep gap | P1 | OpenClaw installer 只執行 `npm install` for `dependencies`，不安裝 `peerDependencies` |
| `plugins.load.paths` | Workaround | 手動安裝 + 在 host config 指定路徑是目前最可靠的方式 |

## Requirements

### 8.5a. SDK Contract Alignment (Done)

| Item | Description |
|------|-------------|
| Entry point | `export default function(api: OpenClawPluginApi)` |
| Config | 從 `api.pluginConfig` 讀取 |
| Types | 移除 5 個自定義 type，import from `openclaw/plugin-sdk` |
| Tool format | 9 tools 轉換為 AgentTool object（`{ name, description, parameters, label, execute }`） |
| Parameters | 轉換為 JSON Schema format |
| Dual-gated | `{ optional: true }` 移至 `registerTool` 第二參數 |
| Manifest | `name` → `id`，configSchema 轉為 JSON Schema |
| package.json | 新增 `"openclaw": { "extensions": ["./dist/index.js"] }`、`openclaw` dev dep |

### 8.5b. Installation Path Documentation (Pending)

| Item | Description |
|------|-------------|
| README 更新 | 新增 "Installation Methods" section，文件化 `plugins.load.paths` 手動安裝路徑 |
| 翻譯同步 | 4 份翻譯 README（zh-TW, zh-CN, ja, ko）同步 "Installation Methods" section（SDK alignment migration 已同步） |
| tmp-openclaw-setup.md | 臨時設定指南（root 層級，未追蹤）；更新 mock API 範例對齊新合約 |

### 8.5c. Dependency Fix (Pending)

| Item | Description |
|------|-------------|
| `dependencies` 新增 | 將 `@agenticvault/agentic-vault` 同時列入 `dependencies`（installer 會安裝）和 `peerDependencies`（語意正確） |
| 理由 | OpenClaw installer 只執行 `npm install` for `dependencies`，不安裝 `peerDependencies` |

### 8.5d. Upstream Issue (Deferred)

| Item | Description |
|------|-------------|
| Issue | OpenClaw installer 使用 `unscopedPackageName` 作為 config key，但 runtime 使用 manifest `id` |
| 影響 | `@agenticvault/openclaw` → unscopedName `openclaw` ≠ manifest `id: "agentic-vault"` |
| Action | npm publish 後向 OpenClaw 提交 issue |

## Scope

| Scope | Description |
|-------|-------------|
| In | SDK contract alignment、dependency fix、README installation path docs、翻譯同步、manifest 更新 |
| Out | Upstream OpenClaw installer fix（需對方修復）、npm publish（需 npm org 設定）、OpenClaw registry submission |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `packages/openclaw-plugin/src/index.ts` | Modified | `export default function(api)` entry |
| `packages/openclaw-plugin/src/types.ts` | Modified | SDK type re-exports |
| `packages/openclaw-plugin/src/tools.ts` | Modified | 9 tools → AgentTool format |
| `packages/openclaw-plugin/package.json` | Modified | `openclaw` field + dev dep |
| `packages/openclaw-plugin/openclaw.plugin.json` | Modified | `name` → `id` + JSON Schema configSchema |
| `packages/openclaw-plugin/README.md` | Modified | Migration guide、installation methods (pending) |
| `packages/openclaw-plugin/README.zh-TW.md` | Modified | 翻譯同步 |
| `packages/openclaw-plugin/README.zh-CN.md` | Modified | 翻譯同步 |
| `packages/openclaw-plugin/README.ja.md` | Modified | 翻譯同步 |
| `packages/openclaw-plugin/README.ko.md` | Modified | 翻譯同步 |
| `packages/openclaw-plugin/test/unit/tools.test.ts` | Modified | AgentTool mock + execute sig |
| `packages/openclaw-plugin/test/unit/trust-boundary.test.ts` | Modified | Allow `openclaw/plugin-sdk` |
| `packages/openclaw-plugin/test/integration/plugin-load.test.ts` | Modified | Default import + `api.pluginConfig` |
| `packages/openclaw-plugin/test/integration/tool-pipeline.test.ts` | Modified | Same as plugin-load |
| `tmp-openclaw-setup.md` | Pending | 臨時設定指南（root 層級，未追蹤）；更新 mock API 範例 |

## Acceptance Criteria

### 8.5a. SDK Contract Alignment
- [x] Entry point 改為 `export default function(api: OpenClawPluginApi)`
- [x] Config 從 `api.pluginConfig` 讀取
- [x] 5 個自定義 type 移除，改用 `openclaw/plugin-sdk` re-exports
- [x] 9 tools 轉換為 AgentTool object format（`{ name, description, parameters, label, execute }`）
- [x] Parameters 轉為 JSON Schema format
- [x] Dual-gated tools 使用 `{ optional: true }` 第二參數
- [x] Manifest `name` → `id`，configSchema 為 JSON Schema
- [x] `package.json` 新增 `"openclaw"` field 和 `openclaw` dev dep
- [x] Trust boundary test 允許 `openclaw/plugin-sdk` import

### 8.5b. Installation Docs
- [x] README 新增 "Installation Methods" section（`plugins.load.paths` 手動安裝路徑 + 已知限制說明）
- [x] 4 份翻譯 README 同步 "Installation Methods" section（SDK alignment migration 已同步）
- [x] Config entries key 修正為 manifest `id`（`"agentic-vault"`），5 份 README 同步
- [ ] `tmp-openclaw-setup.md` 更新 mock API 範例

### 8.5c. Dependency Fix
- [x] `@agenticvault/agentic-vault` 列入 `dependencies`（與 `peerDependencies` 並存）
- [x] `pnpm install` 後驗證 dependency resolution 正確

### 8.5d. Upstream Issue
- [ ] npm publish 完成後向 OpenClaw repo 提交 installer ID mismatch issue

### CI Gates
- [x] `pnpm --filter @agenticvault/openclaw typecheck` 通過
- [x] `pnpm --filter @agenticvault/openclaw test:unit` 通過
- [x] `pnpm -r typecheck` 全專案通過
- [x] `pnpm test:unit` root unit tests 通過（645 tests）
- [x] `pnpm build` 成功

## Implementation Priority

| Sub-phase | Priority | Effort | Status |
|-----------|----------|--------|--------|
| 8.5a. SDK alignment | #1 | Medium | Done |
| 8.5b. Installation docs | #2 | Low | Done |
| 8.5c. Dependency fix | #3 | Low | Done |
| 8.5d. Upstream issue | #4 | Low | Deferred (post-publish) |

## Dependencies

- OpenClaw Plugin (Phase 8) -- Done
- OpenClaw Plugin Refinements -- Done (singleton removal, peerDep fix)

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| `openclaw/plugin-sdk` types runtime mismatch | Medium | Type-only imports；runtime contract is structural |
| Breaking change for `register(api, config)` users | Medium | README migration guide（pre-release → current） |
| Installer ID mismatch blocks `openclaw plugins install` | High | Document `plugins.load.paths` workaround；file upstream issue |
| `dependencies` + `peerDependencies` 衝突 | Low | npm/pnpm 正確處理 dual listing |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium (installation path) |
| SDK Alignment | Done | 8.5a all implemented + tests pass |
| Installation Docs | Done | README + 翻譯 + config key 修正 |
| Dependency Fix | Done | `dependencies` listing + `pnpm install` verified |
| Upstream Issue | Deferred | Post npm publish |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (Phase 8.5)
- Parent Request: [2026-02-14-openclaw-plugin.md](./2026-02-14-openclaw-plugin.md)
- Refinements: [2026-02-15-openclaw-plugin-refinements.md](./2026-02-15-openclaw-plugin-refinements.md)
- Plan: local Claude plans file `typed-wishing-key.md` (SDK alignment implementation plan, not committed to repo)
- OpenClaw Plugin SDK: `openclaw/plugin-sdk` (`openclaw@2026.2.17`)
- OpenClaw Plugin Types: https://github.com/openclaw/openclaw/blob/main/src/plugins/types.ts
- Brainstorming: Codex threads `019c75c1-a57f-77f1-af6a-8922b6bcdde1` (review), `019c75ca-db6e-7450-a2d5-f69a941a511d` (installation)
