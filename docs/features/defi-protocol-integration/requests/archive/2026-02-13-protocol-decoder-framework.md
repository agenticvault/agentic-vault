# Protocol Decoder Framework + Policy V2 Migration

> **Created**: 2026-02-13
> **Status**: Done
> **Priority**: P0
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 1 + Phase 2)
> **Feasibility Study**: [../0-feasibility-study.md](../0-feasibility-study.md)

## Background

建立 `src/protocols/` 模組作為介面無關的協議解碼與策略引擎層。將現有 PolicyEngine 從 `src/agentic/policy/` 遷移至 `src/protocols/policy/`，原地演進為 V2。新增 `./protocols` 子路徑匯出，讓開發者可在無 MCP 依賴下使用協議解碼器與策略引擎。

## Requirements

### Phase 1: Protocol Decoder Framework (1 week)

| Item | Description |
|------|-------------|
| `src/protocols/types.ts` | `DecodedIntent` 辨別聯合型別、`ProtocolDecoder` 介面 |
| `src/protocols/registry.ts` | `ProtocolRegistry`（2-stage dispatch: address → selector） |
| `src/protocols/dispatcher.ts` | `ProtocolDispatcher` 主入口 |
| `src/protocols/index.ts` | `./protocols` 子路徑公開入口 |
| Policy 遷移 | `src/agentic/policy/` → `src/protocols/policy/`，保留 re-export bridge |
| `package.json` | 新增 `./protocols` 子路徑匯出 |
| Trust boundary | ESLint 禁止 agentic deep import protocols 內部；trust-boundary tests 雙向守護 |

### Phase 2: ERC-20 Decoder + Evaluator (1 week)

| Item | Description |
|------|-------------|
| `src/protocols/decoders/erc20.ts` | ERC-20 ABI fragments + `approve`/`transfer` 解碼 |
| `src/protocols/policy/evaluators/erc20.ts` | ERC-20 策略評估器（allowance cap, spender allowlist） |
| PolicyEngine V2 | `evaluate()` 接受 `PolicyRequestV2`（含 `intent?`），fail-closed |
| CLI V2 config | `loadPolicyConfig()` 解析 `protocolPolicies` 欄位 |

## Scope

| Scope | Description |
|-------|-------------|
| In | `src/protocols/` 模組建立、Policy 遷移、ERC-20 解碼器、`./protocols` 匯出、engine-level fail-closed |
| Out | MCP 工具變更（`sign_swap`/`sign_defi_call` 注入 intent 為 Phase 3）、Uniswap/Aave 解碼器、服務層 |

## Acceptance Criteria

### Module Structure
- [x] `src/protocols/` 目錄已建立（types, registry, dispatcher, index）
- [x] `src/protocols/policy/` 包含遷移後的 PolicyEngine（V2 相容 V1）
- [x] `src/agentic/policy/` re-export bridge 存在（標記 deprecated）
- [x] `src/agentic/index.ts` re-export 從 `protocols/` 而非直接匯出
- [x] `package.json` 包含 `./protocols` 子路徑匯出
- [x] Root exports（`.`）保留 PolicyConfig / PolicyRequest / PolicyEvaluation / AuditEntry type-only re-export（向後相容）

### ERC-20 Decoder + Evaluator
- [x] `src/protocols/decoders/erc20.ts` 可正確解碼 `approve` 和 `transfer`
- [x] `src/protocols/policy/evaluators/erc20.ts` 驗證 allowance cap / spender

### Policy Engine V2（engine-level，不含 MCP runtime 行為）
- [x] Fail-closed：已知協議有 intent 但無 evaluator/config → denied
- [x] 向後相容：V1 request（無 intent）仍正常運作，僅執行 V1 base checks

### Trust Boundary
- [x] `test/unit/agentic/trust-boundary.test.ts` 更新：允許 `protocols/index.js`（僅 public entrypoint，禁止 deep import）
- [x] ESLint `no-restricted-imports` 更新：`src/agentic/**` 禁止 deep import `../protocols/` 內部模組
- [x] `test/unit/protocols/trust-boundary.test.ts` 新增：`src/protocols/` 禁止 import `@modelcontextprotocol/*` 及 `src/agentic/`

### Unit Tests
- [x] `test/unit/protocols/registry.test.ts` — ProtocolRegistry 2-stage dispatch
- [x] `test/unit/protocols/dispatcher.test.ts` — ProtocolDispatcher decode flow
- [x] `test/unit/protocols/decoders/erc20.test.ts` — ERC-20 approve/transfer 解碼
- [x] `test/unit/protocols/policy/evaluators/erc20.test.ts` — ERC-20 策略評估

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過
- [x] `pnpm build` 成功

## Dependencies

- None (this is the foundational phase)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Feasibility study + tech spec completed |
| Development | Done | 8 source files + 2 bridges + CLI V2 + package.json |
| Testing | Done | 209 unit tests pass (45+ new) |
| Acceptance | Done | 19/19 AC checked |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (sections 2-4)
- Feasibility Study: [../0-feasibility-study.md](../0-feasibility-study.md)
