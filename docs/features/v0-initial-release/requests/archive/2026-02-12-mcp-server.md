# MCP Server with Policy-Constrained Tools

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-package-layout.md](./2026-02-12-package-layout.md)

## Background

實作 MCP server 作為 Agentic Vault Wallet 的主要整合界面。暴露策略約束的簽名工具，原始簽名預設關閉。每次簽名請求均記錄稽核日誌。

## Requirements

### MCP Tools

| Tool | Description | Default |
|------|-------------|---------|
| `get_address` | 取得錢包地址 | Enabled |
| `health_check` | 驗證 KMS 金鑰設定 | Enabled |
| `sign_swap` | 簽署 swap 交易（需策略檢查） | Enabled |
| `sign_permit` | 簽署 EIP-2612 permit（需策略檢查） | Enabled |
| `sign_transaction` | 原始交易簽名 | **Disabled** |
| `sign_typed_data` | 原始 EIP-712 簽名 | **Disabled** |

### Policy Engine

- chainId 白名單
- 合約地址白名單
- Function selector 白名單
- 金額上限
- Deadline 範圍
- 簽名預覽 + 核准 hook

### Audit Logging

- 每次簽名：who / what / why / when / result
- JSON structured format

## Scope

| Scope | Description |
|-------|-------------|
| In | MCP server、policy engine、audit logging |
| Out | OAuth2.1（Phase 2）、OpenClaw plugin |

## Acceptance Criteria

- [x] MCP server 啟動並暴露 6 個 tools
- [x] `sign_swap` / `sign_permit` 通過 policy engine 檢查
- [x] `sign_transaction` / `sign_typed_data` 預設 disabled
- [x] `--unsafe-raw-sign` flag 啟用原始簽名
- [x] Policy engine 支援 chainId / 合約 / selector / 金額 / deadline
- [x] 每次簽名產生 audit log
- [x] 簽名預覽 + 核准 hook
- [x] Unit tests 覆蓋 policy engine
- [x] Integration test 驗證 MCP tool 呼叫

## Dependencies

- Package Layout (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | MCP server + policy engine + audit logger |
| Testing | ✅ Done | 164 unit tests + behavioral handler tests |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
