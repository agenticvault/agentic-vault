# Monorepo Import Migration

> **Created**: 2026-02-12
> **Status**: Pending
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-repo-extraction.md](./2026-02-12-repo-extraction.md)

## Background

在 dca-executor monorepo 中將所有 `@sd0xdev/vaultsign` 匯入更新為 `@sd0xdev/agentic-vault`。同日協調遷移。

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

- [ ] 所有 `@sd0xdev/vaultsign` import 改為 `@sd0xdev/agentic-vault`
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
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
