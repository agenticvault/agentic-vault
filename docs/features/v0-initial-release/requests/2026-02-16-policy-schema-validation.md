# Policy Config Schema Validation

> **Created**: 2026-02-16
> **Status**: Done
> **Priority**: P0
> **Feature**: v0-initial-release
> **Depends on**: None (independent)
> **Source**: Brainstorming Nash Equilibrium — consultant gap analysis (Claude + Codex, `/codex-brainstorm`)

## Background

`parsePolicyConfig()` 全用 `as` type assertions，無 runtime schema 驗證。錯誤設定可能導致：

| 情境 | 結果 |
|------|------|
| `allowedChainIds: "not-an-array"` | 靜默失敗 → 所有 chainId 被拒 |
| `maxAmountWei: "abc"` | `BigInt("abc")` throws unhelpful error |
| 缺少必要欄位 | default to `[]`/`0` → 可能放行不該放行的請求 |
| `maxDeadlineSeconds: "300"` | string vs number 比較行為不一致 |

顧問評估 + Claude/Codex 獨立研究一致認定：**唯一 v0.1.0 blocker**。

## Requirements

| # | Item | Description |
|---|------|-------------|
| V1 | Zod schema | 定義 `policyConfigV2Schema`，涵蓋所有欄位型別、必填/選填、Address 格式驗證 |
| V2 | `parsePolicyConfig` 重構 | 使用 `safeParse` 取代 `as` assertions，失敗時 throw 明確錯誤訊息 |
| V3 | Fail-fast 啟動 | `loadPolicyConfigFromFile()` 在啟動時驗證，無效 config 直接拒絕啟動 |
| V4 | Error messages | 每個 violation 包含欄位路徑 + 預期型別 + 實際值 |
| V5 | Unit tests | 覆蓋 valid config、missing fields、wrong types、edge cases（empty、null、extra fields） |

## Scope

| Scope | Description |
|-------|-------------|
| In | Zod schema 定義、loader 重構、error messages、unit tests |
| Out | Policy config UI/editor、config file watch/reload、config migration tool |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `src/protocols/policy/loader.ts` | Modify | 加入 Zod schema + safeParse |
| `src/protocols/policy/types.ts` | Keep | Type definitions（Zod schema infer 可對齊） |
| `test/unit/protocols/policy/loader.test.ts` | New | Schema validation tests |
| `package.json` | Modify | 加入 `zod` dependency |

## Acceptance Criteria

### Schema
- [ ] `policyConfigV2Schema` 涵蓋所有 `PolicyConfigV2` 欄位
- [ ] Address 欄位驗證 `0x` prefix + hex 格式
- [ ] `maxAmountWei` 接受 string（BigInt-compatible）或 number
- [ ] `protocolPolicies` 為 optional record，每個 protocol config 有獨立 schema
- [ ] Extra/unknown fields 不報錯（forward compatible）

### Loader
- [ ] `parsePolicyConfig` 使用 Zod `safeParse`
- [ ] 失敗時 throw 帶 Zod error path + message
- [ ] 成功時行為與現有完全一致（normalize lowercase、BigInt 轉換）
- [ ] `loadPolicyConfigFromFile` file not found 時 throw 明確錯誤

### Tests
- [ ] Valid config parse 成功
- [ ] Missing required fields（`allowedChainIds`、`allowedContracts`、`allowedSelectors`）→ 明確錯誤
- [ ] Wrong type（string where array expected）→ 明確錯誤
- [ ] Invalid address format → 明確錯誤
- [ ] `maxAmountWei` 為 non-numeric string → 明確錯誤
- [ ] Empty config `{}` → 明確錯誤（非靜默 default）
- [ ] Extra fields → 不報錯（strip or passthrough）
- [ ] `protocolPolicies` 部分設定（只有 erc20，無 uniswap）→ 成功

### CI Gates
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm lint` 通過
- [ ] `pnpm test:unit` 通過
- [ ] `pnpm build` 成功

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| V1. Zod schema 定義 | #1 | Low | 核心 |
| V2. Loader 重構 | #2 | Low | 核心 |
| V5. Unit tests | #3 | Medium | 品質保證 |
| V3-V4. Fail-fast + error messages | #4 | Low | UX |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium（Claude + Codex 共識 blocker） |
| Development | Done | Zod schema + safeParse in loader.ts |
| Testing | Done | Unit tests pass |
| Acceptance | Done | All AC verified |

## References

- Brainstorming: `/codex-brainstorm` consultant gap analysis (Codex thread: `019c640b-e52f-7961-94e3-c0ba9c3f017a`)
- Current loader: `src/protocols/policy/loader.ts`
- Policy types: `src/protocols/policy/types.ts`
- v0.1.0 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
