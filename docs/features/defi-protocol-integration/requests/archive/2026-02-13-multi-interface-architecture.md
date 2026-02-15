# Multi-Interface Architecture (Workflow + CLI)

> **Created**: 2026-02-13
> **Status**: Done
> **Priority**: P1
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 6)
> **Depends on**: [2026-02-13-security-hardening.md](./2026-02-13-security-hardening.md)
> **Source**: Adversarial brainstorming Nash Equilibrium (Claude + Codex, Codex thread: `019c5796-3448-7180-bcfa-0e738e5cb1dd`)

## Background

目前 agentic-vault 僅有 MCP stdio server 一種介面。Brainstorming 結論：人類（CLI）、AI agent（MCP）、SDK（programmatic import）三種消費者應共用相同的業務邏輯，透過 workflow layer 實現介面無關的共用 pipeline。

## Requirements

### 6a. Extract Workflow Layer

| Item | Description |
|------|-------------|
| 目標 | 將業務邏輯從 `decoded-call-pipeline.ts` 和 `sign-permit.ts` 提取至 `src/protocols/workflows/` |
| 產出 | `WorkflowContext`, `AuditSink` interface, `signDefiCall()`, `signPermit()` workflows |
| 效果 | MCP tools 重構為 thin adapters，Phase 5d 重複消除自然解決 |

### 6b. CLI Entry

| Item | Description |
|------|-------------|
| 目標 | 建立 `src/cli/` 模組，支援 subcommands |
| Binary | `agentic-vault` (main) + `agentic-vault-mcp` (compat alias) |
| Subcommands | `sign`, `sign-permit`, `dry-run`, `get-address`, `health`, `mcp` |
| `mcp` | 呼叫既有 `startStdioServer`（backward compatible） |
| `dry-run` | 僅 decode + policy check，不 signing（無需 AWS credentials） |

### 6c. SDK Export

| Item | Description |
|------|-------------|
| 目標 | 透過 `./protocols` subpath export workflows |
| 驗證 | `./protocols` subpath 不拉入 MCP/CLI 依賴 |

## Scope

| Scope | Description |
|-------|-------------|
| In | Workflow 提取、CLI subcommands、SDK export、trust boundary 更新 |
| Out | 新增協議支援（Aave V3 為獨立需求單）、REST/gRPC API、oracle 整合 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `src/protocols/workflows/types.ts` | New | AuditSink, WorkflowContext, domain result types |
| `src/protocols/workflows/sign-defi-call.ts` | New | decode → policy → sign → audit workflow |
| `src/protocols/workflows/sign-permit.ts` | New | validate → policy → sign → audit workflow |
| `src/protocols/workflows/get-address.ts` | New | address lookup workflow |
| `src/protocols/workflows/health-check.ts` | New | health check workflow |
| `src/protocols/workflows/index.ts` | New | Barrel re-exports |
| `src/protocols/index.ts` | Modify | 新增 workflow re-exports |
| `src/agentic/mcp/tools/decoded-call-pipeline.ts` | Modify | 重構為呼叫 workflow |
| `src/agentic/mcp/tools/sign-permit.ts` | Modify | Security logic 移至 workflow |
| `src/agentic/mcp/tools/result-adapter.ts` | New | `toMcpResult(WorkflowResult)` converter |
| `src/cli/index.ts` | New | CLI entry, subcommand routing |
| `src/cli/context.ts` | New | CLI context builder (parseGlobalArgs, buildWorkflowContext) |
| `src/cli/commands/*.ts` | New | 6 subcommand 實作 |
| `package.json` | Modify | 新增 `agentic-vault` bin |

## Acceptance Criteria

### 6a. Workflow Layer
- [x] `signDefiCall()` workflow 從 MCP pipeline 提取，返回 typed domain result
- [x] `signPermit()` workflow 從 MCP tool 提取，返回 typed domain result
- [x] `AuditSink` interface 注入，`caller` tag 正確傳遞
- [x] MCP tools 重構為 thin adapters（parse → workflow → format）
- [x] 現有 unit/integration/e2e tests 全部通過（行為不變）

### 6b. CLI
- [x] `agentic-vault sign` 可簽名 DeFi 交易
- [x] `agentic-vault dry-run` 可 decode + policy check（無需 AWS）
- [x] `agentic-vault mcp` 啟動 MCP stdio server（等同原 `agentic-vault-mcp`）
- [x] `agentic-vault get-address` 回傳 signer address
- [x] `agentic-vault health` 檢查 KMS 可用性
- [x] CLI 與 MCP 共用相同 PolicyEngine + AuditSink（security parity）

### 6c. SDK Export
- [x] Workflows 可透過 `@agenticvault/agentic-vault/protocols` import
- [x] `./protocols` subpath 不拉入 `@modelcontextprotocol/*` 依賴

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過（375 tests）
- [x] `pnpm build` 成功

## Open Decisions

| Decision | Options | Resolution |
|----------|---------|------------|
| CLI framework | yargs / commander / minimist | 選擇手動 `switch` routing（零依賴），與 `src/agentic/cli.ts` 模式一致 |
| `dry-run` output format | JSON / human-readable / `--json` flag | 預設 JSON pretty-print（`JSON.stringify(details, null, 2)`） |

## Dependencies

- Security Hardening (Phase 5) — Done
- DeFi MCP Tools (Phase 3) — Done

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Brainstorming Nash Equilibrium reached |
| Development | ✅ Done | 6a workflow + 6b CLI + 6c SDK export |
| Testing | ✅ Done | 375 unit + 12 E2E + 42 integration pass |
| Acceptance | ✅ Done | 16/16 AC checked, Codex review ✅, precommit ✅ |

## Implementation Notes

| Metric | Value |
|--------|-------|
| New files | 30 (`src/protocols/workflows/` 6, `src/cli/` 8, `result-adapter.ts` 1, tests 15) |
| Modified files | 5 (`decoded-call-pipeline`, `sign-permit`, `get-address`, `health-check`, `package.json`) |
| Net line change | +973 / -556 |
| Unit tests added | 83 new (292 → 375) |
| Codex review | P0: 0, P1: 1 fixed (signPermit null guard), P2: 2 noted |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (Section 4.8, 4.9, Phase 6)
- Brainstorming: Codex thread `019c5796-3448-7180-bcfa-0e738e5cb1dd`
- Codex review: thread `019c57c8-4c5b-72b0-b81c-06ed83ff8e6c`
- Sepolia Swap CI: [2026-02-13-sepolia-swap-ci.md](./2026-02-13-sepolia-swap-ci.md)
