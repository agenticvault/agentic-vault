# Aave V3 Protocol Support

> **Created**: 2026-02-13
> **Status**: Pending
> **Priority**: P2
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 4)
> **Feasibility Study**: [../0-feasibility-study.md](../0-feasibility-study.md)
> **Depends on**: [2026-02-13-protocol-decoder-framework.md](./2026-02-13-protocol-decoder-framework.md), [2026-02-13-defi-mcp-tools.md](./2026-02-13-defi-mcp-tools.md)

## Background

新增 Aave V3 Pool 合約解碼器，支援 `supply`、`borrow`、`repay`、`withdraw` 四個操作的 calldata 解碼與策略驗證。使用 viem-native ABI 解碼（`@aave/contract-helpers` 已於 2026/01 棄用，不可使用）。

## Requirements

### Aave V3 Decoder

| Item | Description |
|------|-------------|
| `src/protocols/decoders/aave-v3.ts` | Aave V3 Pool ABI + supply/borrow/repay/withdraw 解碼 |
| `src/protocols/policy/evaluators/aave-v3.ts` | Reserve allowlist, onBehalfOf/recipient allowlist, interest rate mode, `maxAmountWei` 驗證 |
| Contract registry | 註冊 mainnet Aave V3 Pool 地址 |

### Supported Actions

| Action | ABI Inputs | Policy Check |
|--------|-----------|-------------|
| `supply` | asset, amount, onBehalfOf, referralCode | Reserve allowlist, onBehalfOf allowlist, `maxAmountWei` |
| `borrow` | asset, amount, interestRateMode, referralCode, onBehalfOf | Reserve allowlist, onBehalfOf allowlist, rate mode, `maxAmountWei` |
| `repay` | asset, amount, interestRateMode, onBehalfOf | Reserve allowlist, onBehalfOf allowlist, `maxAmountWei` |
| `withdraw` | asset, amount, to | Reserve allowlist, recipient allowlist, `maxAmountWei` |

## Scope

| Scope | Description |
|-------|-------------|
| In | Aave V3 解碼器、策略評估器、contract registry 註冊 |
| Out | Aave V3 flashloan、liquidation、其他進階操作 |

## Acceptance Criteria

### Decoder
- [ ] `supply` calldata 正確解碼為 `AaveV3SupplyIntent`
- [ ] `borrow` calldata 正確解碼為 `AaveV3BorrowIntent`
- [ ] `repay` calldata 正確解碼為 `AaveV3RepayIntent`
- [ ] `withdraw` calldata 正確解碼為 `AaveV3WithdrawIntent`
- [ ] 無效 calldata 回傳 `protocol: 'unknown'`

### Policy Evaluator
- [ ] 策略評估器驗證 reserve allowlist（`tokenAllowlist`）
- [ ] 策略評估器驗證 `onBehalfOf` allowlist（supply/borrow/repay）
- [ ] 策略評估器驗證 `maxInterestRateMode`（borrow/repay）
- [ ] 策略評估器驗證 `maxAmountWei`（需擴充 `ProtocolPolicyConfig` schema）
- [ ] `withdraw` 驗證 recipient 在 `recipientAllowlist` 中

### Registry + Integration
- [ ] Mainnet（chainId=1）Aave V3 Pool 地址已註冊（`0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2`）
- [ ] `sign_defi_call` 可正確處理 Aave V3 calldata

### Unit Tests
- [ ] `test/unit/protocols/decoders/aave-v3.test.ts` — 4 action 解碼 + invalid calldata
- [ ] `test/unit/protocols/policy/evaluators/aave-v3.test.ts` — reserve/onBehalfOf/rate/amount 驗證

### CI Gates
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm test:unit` 全部通過
- [ ] `pnpm build` 成功

## Dependencies

- Protocol Decoder Framework (Phase 1+2)
- DeFi MCP Tools (Phase 3) — for `sign_defi_call` integration testing

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Tech spec completed |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (sections 3.1, 4.1, 5)
- Feasibility Study: [../0-feasibility-study.md](../0-feasibility-study.md) (section 8: Aave ABI reference)
- Aave V3 Pool Contract: [IPool.sol](https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol)
