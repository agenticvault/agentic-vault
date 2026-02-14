# Sepolia Swap CI/CD Integration

> **Created**: 2026-02-13
> **Status**: Pending
> **Priority**: P2
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md)
> **Depends on**: [2026-02-13-defi-mcp-tools.md](./2026-02-13-defi-mcp-tools.md), [2026-02-13-security-hardening.md](./2026-02-13-security-hardening.md)

## Background

`test/integration/sepolia-swap.test.ts` 驗證完整的 DeFi 簽名流程：ETH wrap → ERC-20 approve → Uniswap V3 `exactInputSingle` swap，全程透過 AWS KMS 簽名並在 Sepolia 鏈上廣播確認。目前此測試僅能在本地有 AWS 憑證時執行，需整合至 GitHub Actions CI。

同時，`test/e2e/mcp-server.test.ts`（InMemoryTransport + LocalEvmSigner，無外部依賴）尚未納入 CI pipeline。

## Requirements

### 1. E2E Test Job（無外部依賴）

| Item | Description |
|------|-------------|
| 新增 CI job | `e2e-test`，執行 `pnpm test:e2e` |
| 觸發條件 | 所有 push + PR（與 `build-and-test` 相同） |
| 無需 secrets | InMemoryTransport + LocalEvmSigner |

### 2. Sepolia Swap Integration（需 AWS + RPC）

| Item | Description |
|------|-------------|
| 新增 secret | `SEPOLIA_RPC_URL`（Alchemy endpoint） |
| 傳遞至 job | `integration-test` job 的 env 中加入 `SEPOLIA_RPC_URL` |
| 自動 skip | 測試內建 env-gate：無 `SIGNER_KEY_ID` 或餘額不足時自動 skip |

### 3. 選配：Testnet 專屬 Job（建議）

| Item | Description |
|------|-------------|
| 獨立 job | `testnet-swap`，僅在 `main` push 時觸發 |
| 排程觸發 | `schedule: cron '0 8 * * 1'`（每週一 UTC 8:00） |
| 手動觸發 | `workflow_dispatch` 支援手動執行 |
| 超時設定 | `timeout-minutes: 5`（swap 流程 ~40s） |
| 失敗不阻塞 | `continue-on-error: true`（testnet 流動性不穩定） |

## Scope

| Scope | Description |
|-------|-------------|
| In | CI workflow 設定、secrets 管理、job 編排 |
| Out | 測試程式碼修改（已完成）、新 swap 路徑 |

## Acceptance Criteria

- [ ] `pnpm test:e2e` 在 CI 中執行且通過（無需 secrets）
- [ ] `SEPOLIA_RPC_URL` 作為 GitHub secret 傳遞給 integration job
- [ ] Sepolia swap 測試在 `main` push 時執行（有 AWS 憑證時通過、無憑證時 skip）
- [ ] 選配：獨立 testnet job 支援 `schedule` + `workflow_dispatch`
- [ ] CI 失敗時可區分：unit/e2e 失敗（阻塞）vs testnet 失敗（非阻塞）

## Current State

### 現有 CI（`.github/workflows/ci.yml`）

```yaml
jobs:
  build-and-test:     # push + PR: typecheck → lint → test:unit
  integration-test:   # main push: test:integration (AWS secrets)
```

### 缺少的部分

| Gap | Description |
|-----|-------------|
| `test:e2e` 未執行 | InMemoryTransport E2E 測試未納入 CI |
| `SEPOLIA_RPC_URL` 未設定 | 使用 fallback public RPC（不穩定） |
| 無獨立 testnet job | swap 測試混在 integration-test 中，失敗會影響整體 CI |

### 相關測試檔案

| File | Type | External Deps | Duration |
|------|------|---------------|----------|
| `test/e2e/mcp-server.test.ts` | E2E | None | ~37ms |
| `test/integration/sepolia-swap.test.ts` | Integration | AWS KMS + Sepolia RPC | ~40s |
| `test/integration/sepolia-broadcast.test.ts` | Integration | AWS KMS + Sepolia RPC | ~30s |

## Dependencies

- DeFi MCP Tools (Done)
- Security Hardening (Done locally)
- GitHub repo secrets 設定（`SEPOLIA_RPC_URL`）

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | CI gap 分析完成 |
| Development | ⬜ Pending | 修改 `.github/workflows/ci.yml` |
| Testing | ⬜ Pending | PR 觸發 CI 驗證 |
| Acceptance | ⬜ Pending | — |

## Implementation Notes

### 建議 CI 結構

```yaml
jobs:
  build-and-test:        # push + PR
    steps: typecheck → lint → test:unit

  e2e-test:              # push + PR（無需 secrets）
    needs: build-and-test
    steps: test:e2e

  integration-test:      # main push only
    needs: build-and-test
    steps: test:integration
    env: AWS secrets + SEPOLIA_RPC_URL

  testnet-swap:          # main push + weekly + manual（選配）
    needs: build-and-test
    continue-on-error: true
    steps: vitest run test/integration/sepolia-swap.test.ts
```

## References

- 現有 CI：`.github/workflows/ci.yml`
- Sepolia swap 測試：`test/integration/sepolia-swap.test.ts`
- E2E 測試：`test/e2e/mcp-server.test.ts`
