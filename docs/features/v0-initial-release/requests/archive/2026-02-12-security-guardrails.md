# Phase 1 Security Guardrails

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-mcp-server.md](./2026-02-12-mcp-server.md)

## Background

實作 Phase 1 安全防護。金鑰永遠不進入 plugin 層、工具白名單、稽核日誌、釘選 plugin artifacts、完整性驗證、禁止自動安裝/更新。

## Requirements

### 核心安全原則

| 原則 | 說明 |
|------|------|
| Key isolation | 私鑰永遠不暴露於 plugin/skill/MCP 層 |
| Allowlist-only | 只有白名單內的 tools/actions 可被呼叫 |
| Audit everything | 每次簽名記錄完整稽核日誌 |
| No auto-install | 禁止自動安裝/更新 plugin |
| Pin artifacts | 釘選 plugin 版本 + SHA-256 驗證 |

### Integrity Verification

- Plugin artifacts SHA-256 checksum
- `--unsafe-raw-sign` flag 預設 off
- 簽名預覽機制（preview before sign）

## Scope

| Scope | Description |
|-------|-------------|
| In | 安全機制、完整性驗證、audit logging |
| Out | OAuth2.1（Phase 2）、SSRF 防護（Phase 2） |

## Acceptance Criteria

- [x] 私鑰在任何 plugin 執行路徑中無法存取
- [x] 工具白名單機制可設定
- [x] Plugin artifacts 支援 SHA-256 checksum 驗證
- [x] `--unsafe-raw-sign` flag 預設 disabled
- [x] 簽名預覽機制在簽名前觸發
- [x] 安全機制有 unit tests

## Dependencies

- MCP Server (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | Key isolation + unsafe-raw-sign flag + policy engine |
| Testing | ✅ Done | ESLint trust boundary + unsafe-flag tests |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
