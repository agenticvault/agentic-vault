# Monorepo Import Migration

> **Created**: 2026-02-12
> **Status**: Deferred
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-repo-extraction.md](./archive/2026-02-12-repo-extraction.md)

## Background

在 dca-executor monorepo 中將所有 `@agenticvault/agentic-vault` 匯入更新為 `@agenticvault/agentic-vault`。同日協調遷移。

## Requirements

### 消費者清單

| File | Import |
|------|--------|
| `packages/dca-core/src/infra/chain-types.ts` | `SignerAdapter` type |
| `packages/dca-core/src/application/swap.ts` | `SignerAdapter` type |
| `packages/dca-core/src/application/facade.ts` | `SignerAdapter` type |
| `apps/dca-executor/src/infra/chain/client.ts` | `SignerAdapter`, `SignTypedDataParams` types |
| `apps/dca-executor/src/cli.ts` | `KmsSignerAdapter`, `AwsKmsClient` |
| `apps/dca-executor/src/cli/doctor.ts` | `SignerAdapter` type |
| `apps/dca-executor/src/index.ts` | Re-exports |

### 步驟

1. 更新 `packages/dca-core/package.json` 依賴
2. 更新 `apps/dca-executor/package.json` 依賴
3. 更新所有 import statements
4. 驗證 typecheck + 全部測試通過

## Scope

| Scope | Description |
|-------|-------------|
| In | import 遷移、依賴更新、測試驗證 |
| Out | 新功能開發 |

## Acceptance Criteria

- [ ] 所有 `@agenticvault/agentic-vault` import 改為 `@agenticvault/agentic-vault`
- [ ] `packages/dca-core/package.json` 已更新
- [ ] `apps/dca-executor/package.json` 已更新
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm test` 全部通過
- [ ] 無殘留 `vaultsign` 參照（grep 驗證）

## Dependencies

- Repo Extraction (Done)
- New package published to npm (Pending)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Consumer list identified |
| Development | Deferred | 等專案成熟後再考慮（2026-02-14 決議） |
| Testing | Deferred | — |
| Acceptance | Deferred | — |

> **Deferred reason**: 此需求作用於外部 repo（dca-executor monorepo），非本 repo 可獨立完成。等專案成熟、npm publish 穩定後再處理。

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
