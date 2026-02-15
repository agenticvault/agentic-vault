# Sepolia Swap CI/CD Integration

> **Created**: 2026-02-13
> **Status**: Done
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
| 觸發條件 | `main` push + target `main` PR + dispatch（`schedule` 時 skip） |
| 無需 secrets | InMemoryTransport + LocalEvmSigner |

### 2. Sepolia Swap Integration（需 AWS + RPC）

| Item | Description |
|------|-------------|
| 新增 secret | `SEPOLIA_RPC_URL`（Alchemy endpoint） |
| 傳遞至 job | `testnet-swap` job 的 env 中加入 `SEPOLIA_RPC_URL` |
| 自動 skip | 測試內建 env-gate：無 `SIGNER_KEY_ID` 或餘額不足時自動 skip |
| 隔離 | `integration-test` 排除 `sepolia-*.test.ts`，避免 testnet 失敗影響 CI |

### 3. Testnet 專屬 Job

| Item | Description |
|------|-------------|
| 獨立 job | `testnet-swap`，在 `main` push + schedule + dispatch 時觸發 |
| 排程觸發 | `schedule: cron '0 8 * * 1'`（每週一 UTC 8:00） |
| 手動觸發 | `workflow_dispatch` 支援手動執行 |
| 超時設定 | `timeout-minutes: 5`（swap 流程 ~40s） |
| 失敗不阻塞 | `continue-on-error: true`（testnet 流動性不穩定） |
| 測試範圍 | `sepolia-swap.test.ts` + `sepolia-broadcast.test.ts` |

### 4. Security

| Item | Description |
|------|-------------|
| Least privilege | Workflow-level `permissions: { contents: read }` |
| Secret scoping | AWS secrets 僅在需要的 job 中暴露 |

## Scope

| Scope | Description |
|-------|-------------|
| In | CI workflow 設定、secrets 管理、job 編排 |
| Out | 測試程式碼修改（已完成）、新 swap 路徑 |

## Acceptance Criteria

- [x] `pnpm test:e2e` 在 CI 中執行且通過（無需 secrets）
- [x] `SEPOLIA_RPC_URL` 作為 GitHub secret 傳遞給 testnet-swap job
- [x] Sepolia swap 測試在 `main` push 時執行（有 AWS 憑證時通過、無憑證時 skip）
- [x] 獨立 testnet job 支援 `schedule` + `workflow_dispatch`
- [x] CI 失敗時可區分：unit/e2e 失敗（阻塞）vs testnet 失敗（非阻塞）
- [x] `integration-test` 排除 `sepolia-*.test.ts`（非阻塞隔離）
- [x] Workflow-level `permissions: { contents: read }` 已設定

## Current State

### 實作後 CI（`.github/workflows/ci.yml`）

```yaml
jobs:
  build-and-test:        # all events: typecheck → lint → test:unit
  e2e-test:              # main push + target main PR + dispatch（skip schedule）
    needs: build-and-test
    steps: test:e2e
  integration-test:      # main push only（排除 sepolia-*）
    needs: build-and-test
    steps: vitest run test/integration --exclude 'test/integration/sepolia-*.test.ts'
    env: AWS secrets
  testnet-swap:          # main push + weekly + manual
    needs: build-and-test
    continue-on-error: true
    timeout-minutes: 5
    steps: vitest run sepolia-swap + sepolia-broadcast
    env: AWS secrets + SEPOLIA_RPC_URL
```

### 相關測試檔案

| File | Type | External Deps | Duration |
|------|------|---------------|----------|
| `test/e2e/mcp-server.test.ts` | E2E | None | ~37ms |
| `test/integration/sepolia-swap.test.ts` | Integration | AWS KMS + Sepolia RPC | ~40s |
| `test/integration/sepolia-broadcast.test.ts` | Integration | AWS KMS + Sepolia RPC | ~30s |

## Dependencies

- DeFi MCP Tools (Done)
- Security Hardening (Done)
- GitHub repo secrets 設定（`SEPOLIA_RPC_URL`）— 需 repo admin 手動設定

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | CI gap 分析完成 |
| Development | ✅ Done | `.github/workflows/ci.yml` 更新完成 |
| Testing | ✅ Done | lint + build + 424 unit tests pass |
| Acceptance | ✅ Done | 7/7 AC checked |

## References

- CI workflow：`.github/workflows/ci.yml`
- Sepolia swap 測試：`test/integration/sepolia-swap.test.ts`
- E2E 測試：`test/e2e/mcp-server.test.ts`
