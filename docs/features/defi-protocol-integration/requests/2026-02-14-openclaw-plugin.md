# OpenClaw Plugin (Phase 8)

> **Created**: 2026-02-14
> **Status**: Done
> **Priority**: P0
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 8)
> **Depends on**: [2026-02-13-multi-interface-architecture.md](./archive/2026-02-13-multi-interface-architecture.md) (workflow layer), [2026-02-14-onboarding-improvements.md](./archive/2026-02-14-onboarding-improvements.md) (env var fallback)
> **Source**: 產品推廣需求 brainstorming Nash Equilibrium (Claude + Codex, Codex threads: `019c5a43-1350-76a1-8ac0-048c1b498173`, `019c5a4d-4abe-7840-b81a-e1212985ee70`)

## Background

OpenClaw（前身 Clawdbot/Moltbot）是 2026 年最熱門的開源 AI agent framework（160K+ GitHub stars）。為產品推廣，需要讓 agentic-vault 作為 OpenClaw plugin 使用。

Phase 6 建立的 workflow layer（`src/protocols/workflows/`）使得新增 interface adapter 只需 thin wrapper。OpenClaw plugin 是繼 MCP、CLI、SDK 之後的第四個 consumer。

### ADR-001 Decision 4 修訂

原始 ADR-001 因 2026/01 ClawHavoc 安全事件（341 malicious plugins，9K+ 安裝受影響）而 blanket defer OpenClaw 支援。經重新評估：

| 風險 | 原始評估 | 重新評估 | 原因 |
|------|---------|---------|------|
| Key exfiltration | High | **Low** | HSM boundary — private key never leaves KMS |
| Unauthorized signing | High | **Medium** | Policy engine + deny-by-default mitigates |
| Supply chain attack | High | **Medium** | npm provenance + OIDC + separate package |
| Prompt injection → signing | N/A | **Medium** | Policy engine 限制 chain/contract/amount/deadline |

修訂為 **Phase 1.5: Controlled launch**，僅官方 plugin，配合 4 項必要控制。

## Requirements

### 8a. 獨立套件建立

| Item | Description |
|------|-------------|
| 套件名稱 | `@agenticvault/openclaw` |
| 位置 | `packages/openclaw-plugin/` |
| Workspace 設定 | 新增 `pnpm-workspace.yaml`（`packages: ['packages/*']`）；root `package.json` 不需 `workspaces` field（pnpm 使用獨立 workspace file） |
| Dependencies | `peerDependencies: { "@agenticvault/agentic-vault": "~0.1.1", "openclaw": ">=2026.1.0" }` |
| Import 限制 | 僅 import public API（`@agenticvault/agentic-vault` + `@agenticvault/agentic-vault/protocols` + `openclaw/plugin-sdk`） |

### 8b. Tool Registration（7 safe + 2 dual-gated）

| Item | Description |
|------|-------------|
| Safe tools | `vault_get_address`, `vault_health_check`, `vault_sign_defi_call`, `vault_sign_permit`, `vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer` |
| Dual-gated tools | `vault_sign_transaction`, `vault_sign_typed_data`（雙重保護：`{ optional: true }` + 需 config 中 `enableUnsafeRawSign: true` 才註冊） |
| Gating 機制 | 即使 OpenClaw agent allowlist 啟用 optional tool，仍需使用者在 plugin config 中明確設定 `enableUnsafeRawSign: true`，與 CLI `--unsafe-raw-sign` 對齊 |
| Response format | `{ content: [{ type: 'text', text: string }] }`（OpenClaw 標準格式） |
| Parameter schema | JSON Schema（TypeBox compatible） |

### 8c. Config → WorkflowContext

| Item | Description |
|------|-------------|
| Config source | OpenClaw `plugins.entries.agentic-vault.config` |
| 必填欄位 | `keyId`, `region` |
| 選填欄位 | `expectedAddress`, `policyConfigPath` |
| Caller tag | `caller: 'openclaw'`（審計日誌標記）— 需擴展 `WorkflowCaller` type union |
| AWS credentials | Host default credential chain（不寫入 plugin config） |
| Default policy | deny-all（無 policy config 時所有簽名操作被拒絕） |

### 8d. ADR-001 更新

| Item | Description |
|------|-------------|
| 修訂 | Phase 1 blanket defer → Phase 1.5 controlled launch |
| 控制 1 | Policy engine 強制啟用（deny-all default） |
| 控制 2 | 高風險工具雙重保護：`{ optional: true }` + `enableUnsafeRawSign` config flag（與 CLI `--unsafe-raw-sign` 對齊） |
| 控制 3 | npm `--provenance` + `id-token: write` OIDC attestation |
| 控制 4 | 版本固定指引 + 禁止 auto-install（使用者應固定 exact version，npm 不自動升級 plugin） |

### 8e. CI + Distribution

| Item | Description |
|------|-------------|
| CI（PR/push） | `.github/workflows/openclaw-ci.yml` — typecheck + lint + test on PR/push to `packages/openclaw-plugin/**` + shared deps（`pnpm-workspace.yaml`, root `package.json`, root `tsconfig*`） |
| CI（release） | `.github/workflows/release-openclaw.yml` — npm publish on tag `openclaw-v*` |
| npm | `@agenticvault/openclaw`，`--access public` |
| Provenance | `--provenance` flag + `id-token: write` permission (OIDC attestation) |
| Ecosystem | 發布後提交至 OpenClaw 官方 extension 目錄 |

## Scope

| Scope | Description |
|-------|-------------|
| In | 獨立 OpenClaw plugin 套件、7+2 tools（含 balance/transfer）、config schema、ADR 更新、CI、SDK alignment |
| Out | HTTP/SSE transport（不需要）、OpenClaw-specific skills（deferred）、Aave tools（Phase 4） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `pnpm-workspace.yaml` | New | Workspace 設定（`packages: ['packages/*']`） |
| `packages/openclaw-plugin/package.json` | New | Plugin npm manifest |
| `packages/openclaw-plugin/tsconfig.json` | New | TypeScript config（standalone, ES2022） |
| `packages/openclaw-plugin/src/index.ts` | New | Plugin entry — `export default function(api)` (SDK-aligned) |
| `packages/openclaw-plugin/src/types.ts` | New | SDK type re-exports + `OpenClawPluginConfig` |
| `packages/openclaw-plugin/src/tools.ts` | New | Tool definitions → workflow delegation (AgentTool format) |
| `packages/openclaw-plugin/src/context.ts` | New | OpenClaw config → WorkflowContext |
| `packages/openclaw-plugin/openclaw.plugin.json` | New | OpenClaw manifest (configSchema) |
| `packages/openclaw-plugin/test/unit/tools.test.ts` | New | Tool registration + workflow delegation tests |
| `packages/openclaw-plugin/test/unit/context.test.ts` | New | Config builder tests |
| `packages/openclaw-plugin/test/unit/trust-boundary.test.ts` | New | Import 限制驗證（僅 public API） |
| `packages/openclaw-plugin/test/integration/plugin-load.test.ts` | New | Plugin default export loading test |
| `packages/openclaw-plugin/test/integration/tool-pipeline.test.ts` | New | Tool → workflow pipeline integration test |
| `src/protocols/workflows/types.ts` | Modify | `WorkflowCaller` type 新增 `'openclaw'` |
| `docs/project/adrs/ADR-001-architecture-decisions.md` | Modify | Decision 4 → Phase 1.5 |
| `.github/workflows/openclaw-ci.yml` | New | PR/push CI（typecheck + lint + test） |
| `.github/workflows/release-openclaw.yml` | New | Release workflow（npm publish + provenance） |

## Acceptance Criteria

### 8a. 獨立套件
- [x] `pnpm-workspace.yaml` 建立（`packages: ['packages/*']`）
- [x] `packages/openclaw-plugin/` 建立並可獨立 build
- [x] `peerDependencies` 正確設定
- [x] 僅 import public API（無內部路徑）
- [x] Trust boundary test 驗證 import 限制（`packages/openclaw-plugin/test/unit/trust-boundary.test.ts`）

### 8b. Tool Registration
- [x] 7 safe tools 透過 `api.registerTool(AgentTool, opts?)` 正確註冊（SDK format with `label`, JSON Schema `parameters`）
- [x] 2 dual-gated tools：`{ optional: true }` + `enableUnsafeRawSign` config flag 雙重檢查
- [x] 無 `enableUnsafeRawSign: true` 時，即使 OpenClaw allowlist 啟用 optional tool 也不註冊
- [x] 每個 tool 正確呼叫對應 workflow 函式
- [x] Response 格式符合 OpenClaw 標準

### 8c. Context Builder
- [x] OpenClaw config → WorkflowContext 正確轉換
- [x] `WorkflowCaller` type 新增 `'openclaw'`（`src/protocols/workflows/types.ts`）
- [x] `caller: 'openclaw'` 出現在審計日誌
- [x] Signer + PolicyEngine factory pattern（每次 `buildContext()` 建立新 instance，caller 自行 cache）
- [x] Missing `keyId`/`region` → 清楚錯誤訊息
- [x] 無 policy config → deny-all behavior

### 8d. ADR Update
- [x] ADR-001 Decision 4 修訂為 Phase 1.5
- [x] 風險重新評估記錄
- [x] 4 項必要控制文件化（policy 強制、雙重 gating、npm provenance、版本固定指引）

### 8e. CI + Distribution
- [x] `openclaw-ci.yml` 通過 PR/push 觸發（typecheck + lint + test）
- [x] `release-openclaw.yml` 通過 tag 觸發 npm publish
- [x] npm publish 使用 `--provenance --access public`
- [ ] Package 可被 OpenClaw extension 系統載入（⚠️ 已知 blocker: installer ID mismatch — 見 Phase 8.5 brainstorm）

### Open-Source Readiness 補充修復
- [x] `packages/openclaw-plugin/package.json` 新增 `prepack` 腳本（確保 publish 前自動 build）
- [x] `packages/openclaw-plugin/package.json` 新增 `bugs` / `homepage` 欄位
- [x] `packages/openclaw-plugin/README.md` 建立（安裝、設定、tools 表、安全說明）
- [x] `.github/workflows/release-openclaw.yml` 新增 `typecheck` + `lint` 步驟

### CI Gates
- [x] `pnpm --filter @agenticvault/openclaw typecheck` 通過
- [x] `pnpm --filter @agenticvault/openclaw test:unit` 通過
- [x] `pnpm -r typecheck` 全專案通過（root + openclaw-plugin）
- [x] `pnpm -r test:unit` 全專案通過
- [x] `pnpm build` 成功（root）
- [x] OpenClaw plugin 獨立 build 成功

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| 8a. 獨立套件 | #1 | Low | Foundation |
| 8b. Tool registration | #2 | Medium | Core value |
| 8c. Context builder | #3 | Low | Core value |
| 8d. ADR update | #4 | Low | Governance |
| 8e. CI + distribution | #5 | Low | Distribution |

## Resolved Decisions

| Decision | Options | Default | Resolution |
|----------|---------|---------|------------|
| Monorepo vs separate repo | `packages/` subfolder / standalone repo | `packages/` | ✅ `packages/` + `pnpm-workspace.yaml`（與 core 共同版本管理，pnpm workspace 支援獨立 build/test） |
| OpenClaw tool naming prefix | `vault_` / `agentic_vault_` / no prefix | `vault_` | ✅ `vault_`（簡潔，避免衝突） |
| npm org scope | `@sd0xdev` / `@agenticvault` / `@openclaw` | `@agenticvault` | ✅ `@agenticvault`（namespace migration 後統一） |

## Dependencies

- Multi-Interface Architecture (Phase 6) -- Done (workflow layer)
- CLI UX Improvements (Phase 7) -- Done (not blocking, but validates adapter pattern)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium reached |
| Development | Done | All source files implemented |
| Testing | Done | 46 plugin tests (38 unit + 8 integration) + 645 root tests = 691 total |
| Acceptance | Done | All AC checked; OpenClaw registry submission pending npm publish |
| SDK Alignment | Done | Phase 8.5: Migrated to `openclaw/plugin-sdk` official contract (2026-02-19) |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (Phase 8)
- ADR-001: [../../../project/adrs/ADR-001-architecture-decisions.md](../../../project/adrs/ADR-001-architecture-decisions.md)
- OpenClaw Plugin Agent Tools: https://docs.openclaw.ai/plugins/agent-tools
- OpenClaw Extension Architecture: https://deepwiki.com/openclaw/openclaw/10-extensions-and-plugins
- ClawHavoc Security Incident: https://www.digitalapplied.com/blog/ai-agent-plugin-security-lessons-clawhavoc-2026
- npm Trusted Publishers: https://docs.npmjs.com/trusted-publishers/
- Brainstorming: Codex threads `019c5a43-1350-76a1-8ac0-048c1b498173`, `019c5a4d-4abe-7840-b81a-e1212985ee70`
- SDK Alignment: Codex thread `019c75c1-a57f-77f1-af6a-8922b6bcdde1` (review), `019c75ca-db6e-7450-a2d5-f69a941a511d` (installation brainstorm)
