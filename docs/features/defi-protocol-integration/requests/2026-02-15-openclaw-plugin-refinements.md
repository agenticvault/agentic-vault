# OpenClaw Plugin Architecture Refinements

> **Created**: 2026-02-15
> **Status**: Done
> **Priority**: P1
> **Feature**: defi-protocol-integration
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm`)
> **Thread**: `019c60cb-d1cd-7531-8c26-7e3fe31b9bb9`

## Background

OpenClaw plugin 架構經 Claude + Codex 對辯後達成共識：in-process thin adapter 設計在 Phase 1.5 controlled launch 是正確的，但有 3 個結構性改善項需在 v0.1.0 前或緊接修正。

### Nash Equilibrium 共識

| 議題 | 結論 |
|------|------|
| In-process 架構 | Phase 1.5 正確，KMS 是真正的 key boundary |
| Out-of-process | Phase 2 trigger（multi-tenant 或高風險部署） |
| Policy parsing 重複 | Core 應導出 parser |
| Global singleton | 應支援 multi-instance |
| peerDep 版控 | `~0.1.0` + 文件建議 exact pin |
| WorkflowContext | 現有 4 interface 分解 OK |
| Trust boundary test | Import hygiene 足以防 coupling |

## Requirements

### R1: Export `parsePolicyConfig` from Core (P1)

**問題**: `loadPolicyConfig()` 重複實作於 3 處，邏輯幾乎相同但各自維護，有 drift 風險。

| 位置 | LOC | 說明 |
|------|-----|------|
| `src/cli/context.ts:70` | ~45 | CLI context 使用 |
| `src/agentic/cli.ts:66` | ~45 | MCP CLI 使用 |
| `packages/openclaw-plugin/src/context.ts:100` | ~40 | OpenClaw plugin 使用 |

**方案**: 在 `src/protocols/` 導出 pure parser + Node.js file loader。

```typescript
// src/protocols/policy/loader.ts (new)
export function parsePolicyConfig(raw: unknown): PolicyConfigV2;      // pure parser
export function loadPolicyConfigFromFile(path: string): PolicyConfigV2; // Node.js fs wrapper
```

- 從 `@agenticvault/agentic-vault/protocols` subpath 導出
- 3 處消費者改為 import 共用函式
- 刪除各自的重複實作

### R2: Remove Global Singleton in `buildContext` (P2)

**問題**: `packages/openclaw-plugin/src/context.ts:29` 使用 module-level singleton，一個 process 只允許一個 config，mismatch 時 throw。

```typescript
let cachedContext: WorkflowContext | undefined;  // line 29
let cachedConfigKey: string | undefined;          // line 30
```

**方案**: 改為 factory pattern，每次呼叫回傳新 instance。

```typescript
// Before
export function buildContext(config: OpenClawPluginConfig): WorkflowContext;

// After — singleton 移除，每次回傳新 instance（函式名稱保留 buildContext）
export function buildContext(config: OpenClawPluginConfig): WorkflowContext;
```

- 移除 `cachedContext` / `cachedConfigKey` 全域變數
- 移除 `_resetCachedContext()` test helper（不再需要）
- Caller 自行 cache（OpenClaw host 通常只建立一次）
- 更新 `packages/openclaw-plugin/test/context.test.ts` 移除 singleton 相關測試

### R3: Fix peerDep Range to Align with ADR (P1)

**問題**: ADR-001 Decision 4 要求使用者固定 exact version（line 169），但 `packages/openclaw-plugin/package.json:35` 用 `^0.1.0`（caret range）。

**方案**: 改為 `~0.1.0`（tilde range，允許 patch 但不允許 minor）。

```diff
- "@agenticvault/agentic-vault": "^0.1.0"
+ "@agenticvault/agentic-vault": "~0.1.0"
```

- 文件（README、CONTRIBUTING）補充建議生產環境 exact pin

## Scope

| Scope | Description |
|-------|-------------|
| In | Policy parser 導出、singleton 移除、peerDep 修正、對應測試更新 |
| Out | Out-of-process 架構（Phase 2）、WorkflowContext 重構、新 protocol 支援 |

## Related Files

| Category | Files | Changes |
|----------|-------|---------|
| New | `src/protocols/policy/loader.ts` | parsePolicyConfig + loadPolicyConfigFromFile |
| Modify | `src/protocols/index.ts` | 導出 loader |
| Modify | `src/cli/context.ts` | 刪除重複 loadPolicyConfig，改 import |
| Modify | `src/agentic/cli.ts` | 刪除重複 loadPolicyConfig，改 import |
| Modify | `packages/openclaw-plugin/src/context.ts` | 刪除重複 loadPolicyConfig，改 import；移除 singleton |
| Modify | `packages/openclaw-plugin/package.json` | peerDep `^` → `~` |
| Modify | `packages/openclaw-plugin/test/context.test.ts` | 更新 singleton 相關測試 |
| Add | `test/unit/protocols/policy/loader.test.ts` | 新 parser 單元測試 |

## Acceptance Criteria

### R1: parsePolicyConfig
- [ ] `src/protocols/policy/loader.ts` 導出 `parsePolicyConfig` 和 `loadPolicyConfigFromFile`
- [ ] `@agenticvault/agentic-vault/protocols` subpath 可 import
- [ ] `src/cli/context.ts`、`src/agentic/cli.ts`、`packages/openclaw-plugin/src/context.ts` 三處改用共用函式
- [ ] 重複的 `loadPolicyConfig` 實作已刪除
- [ ] 新增 `test/unit/protocols/policy/loader.test.ts` 覆蓋 parser

### R2: Singleton removal
- [ ] `cachedContext` / `cachedConfigKey` 全域變數已移除
- [ ] `_resetCachedContext()` 已移除
- [ ] 多次呼叫 `buildContext()` 可回傳不同 instance（函式名稱保留 `buildContext`，singleton 行為已移除）
- [ ] 測試已更新

### R3: peerDep
- [ ] `packages/openclaw-plugin/package.json` peerDep 改為 `~0.1.0`
- [ ] README / CONTRIBUTING 補充 exact pin 建議

### Verify
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm lint` 通過
- [ ] `pnpm test:unit` 通過
- [ ] `pnpm --filter @agenticvault/openclaw test:unit` 通過
- [ ] Trust boundary test 仍通過

## Dependencies

- None（純重構，不影響外部 API）

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Parser 行為不一致 | Low | 三處現有邏輯相同，抽取後加 unit test |
| Singleton 移除影響 OpenClaw host | Low | OpenClaw host 呼叫 `register()` 一次，行為不變 |
| peerDep 變更影響消費者 | None | v0.1.0 未發佈，零消費者 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium |
| Development | Done | R1+R2+R3 all implemented |
| Testing | Done | Existing tests pass |
| Acceptance | Done | All AC verified |

## References

- Brainstorming: `/codex-brainstorm` OpenClaw plugin architecture (Thread: `019c60cb-d1cd-7531-8c26-7e3fe31b9bb9`)
- ADR-001 Decision 4: [OpenClaw 整合策略](../../../project/adrs/ADR-001-architecture-decisions.md)
- OpenClaw Plugin: [2026-02-14-openclaw-plugin.md](../2026-02-14-openclaw-plugin.md)
