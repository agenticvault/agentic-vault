# Provider Abstraction Layer

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P2
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-package-layout.md](./2026-02-12-package-layout.md)

## Background

實作 provider 抽象層，為未來新增 Coinbase CDP、Local Keystore 等 provider 做準備。目前僅 AWS KMS，但架構需支援多 provider 切換。

## Requirements

- `SigningProvider` 抽象介面（建立在現有 `SignerAdapter` 之上）
- Provider registry / factory pattern
- AWS KMS provider 重構為符合新抽象
- 設定檔支援 provider 選擇

## Scope

| Scope | Description |
|-------|-------------|
| In | Provider 抽象、factory、AWS KMS 重構 |
| Out | 新 provider 實作（CDP 等） |

## Acceptance Criteria

- [x] `SigningProvider` 介面已定義
- [x] Provider factory 可根據設定建立對應 provider
- [x] AWS KMS 重構為 `AwsKmsProvider` 實作 `SigningProvider`
- [x] 現有測試全部通過（無行為變更）
- [x] 新增 provider factory unit tests

## Dependencies

- Package Layout (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | vaultsign tech spec 已規劃 |
| Development | ✅ Done | SigningProvider + AwsKmsProvider + factory |
| Testing | ✅ Done | Provider factory + adapter tests |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
- vaultsign Tech Spec: `packages/vaultsign/docs/2-tech-spec.md` (original)
