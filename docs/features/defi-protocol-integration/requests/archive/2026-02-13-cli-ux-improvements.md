# CLI UX Improvements (Phase 7)

> **Created**: 2026-02-13
> **Status**: Done
> **Priority**: P1
> **Feature**: defi-protocol-integration
> **Tech Spec**: [../2-tech-spec.md](../2-tech-spec.md) (Phase 7)
> **Depends on**: [2026-02-13-multi-interface-architecture.md](./2026-02-13-multi-interface-architecture.md)
> **Source**: CLI UX brainstorming Nash Equilibrium (Claude + Codex, Codex thread: `019c5a01-4b71-72f1-87fe-d55d291e5a74`)

## Background

Phase 6b 建立了 CLI 基礎架構（6 subcommands），但使用者必須手動組裝 raw hex calldata（`--data 0x095ea7b3...`），DX 門檻高。Brainstorming 結論：分層設計 L0（raw hex 保留）、L1（`encode`/`decode` subcommands，復用 decoder ABIs）、L2（curated intent aliases，未來）。

## Requirements

### 7a. `encode` / `decode` Subcommands（Priority #1）

| Item | Description |
|------|-------------|
| 目標 | 讓使用者透過 intent-level 參數產生 calldata，無需手動組裝 hex |
| `encode` | `agentic-vault encode erc20:approve --spender 0x... --amount 1000000` → `0x095ea7b3...` |
| `decode` | `agentic-vault decode --chain-id 1 --to 0x... --data 0x...` → intent JSON |
| 核心 | Protocol Action Catalog（`src/protocols/catalog.ts`）共用 ABI metadata |
| 優勢 | 復用既有 decoder ABIs，避免 encoder/decoder drift |

### 7b. `--output` Global Flag

| Item | Description |
|------|-------------|
| 目標 | 統一所有 subcommand 的輸出格式控制 |
| 選項 | `json`（預設，pretty-print）/ `human`（aligned key-value table）/ `raw`（minimal：sign → hex、encode → hex、decode/dry-run → compact JSON） |

### 7c. stdin Support

| Item | Description |
|------|-------------|
| 目標 | 支援 pipe 模式，與其他工具組合使用 |
| 行為 | `--data -` 從 stdin 讀取 calldata |
| 範例 | `cast calldata "approve(...)" 0x... 1000000 \| agentic-vault sign --chain-id 1 --to 0x... --data -` |

### 7d. Permit Simplification

| Item | Description |
|------|-------------|
| 目標 | 簡化 `sign-permit` 的使用體驗 |
| 行為 | `--file permit.json` 自動從 JSON 提取所有必要欄位 |
| 現況 | 需要 6 個 flags + `--payload` JSON file |

### 7e. Interactive TTY Confirmation

| Item | Description |
|------|-------------|
| 目標 | TTY 環境下簽名前顯示 decoded intent 並要求確認 |
| 行為 | 顯示 protocol / action / args，使用者按 y/N 確認 |
| Override | `--yes` flag 跳過確認（CI/pipe 環境） |
| 偵測 | `process.stdin.isTTY && process.stdout.isTTY` 雙向檢測互動環境 |
| Preview | 使用 default registry（`createDefaultRegistry()`）decode intent，非 workflow ctx |
| Non-TTY 行為 | 自動跳過確認（等同 `--yes`），避免 pipe/CI 環境卡住 |

## Scope

| Scope | Description |
|-------|-------------|
| In | `encode`/`decode` subcommands、`--output` flag、stdin support、permit simplification、TTY confirmation |
| Out | L2 curated aliases（deferred）、REST API、新協議支援 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `src/protocols/catalog.ts` | New | Protocol Action Catalog（shared ABI metadata） |
| `src/cli/commands/encode.ts` | New | encode subcommand |
| `src/cli/commands/decode.ts` | New | decode subcommand |
| `src/cli/index.ts` | Modify | 新增 encode/decode routing |
| `src/cli/formatters.ts` | New | Human-readable output formatter |
| `src/cli/commands/sign.ts` | Modify | 新增 `--yes` flag、stdin support、TTY confirmation |
| `src/cli/commands/sign-permit.ts` | Modify | 新增 `--file` flag 自動提取欄位 |
| `src/cli/commands/dry-run.ts` | Modify | 新增 `--output` flag、stdin support |
| `src/protocols/decoders/erc20.ts` | Modify | Export ABI for catalog |
| `src/protocols/decoders/uniswap-v3.ts` | Modify | Export ABI for catalog |

## Acceptance Criteria

### 7a. encode / decode
- [x] `agentic-vault encode erc20:approve --spender 0x... --amount N` 產生正確 calldata
- [x] `agentic-vault encode uniswap_v3:exactInputSingle --tokenIn 0x... ...` 產生正確 calldata
- [x] `agentic-vault decode --chain-id 1 --to 0x... --data 0x...` 輸出 intent JSON
- [x] Action Catalog 與 decoder ABIs 共用來源（無 drift）
- [x] 未知 action 名稱回傳清楚錯誤

### 7b. --output flag
- [x] `--output json` 輸出 JSON（預設行為不變）
- [x] `--output human` 輸出 human-readable table
- [x] `--output raw` 輸出 minimal data（sign/encode → hex、decode/dry-run → compact JSON）

### 7c. stdin
- [x] `echo '0x...' | agentic-vault decode --chain-id 1 --to 0x... --data -` 從 stdin 讀取
- [x] `--data -` 時從 stdin 讀取一行作為 calldata（last-write-wins semantics）

### 7d. Permit Simplification
- [x] `agentic-vault sign-permit --file permit.json` 自動提取所有欄位
- [x] 向後相容：既有 6-flag 方式仍可使用

### 7e. Interactive Confirmation
- [x] TTY 環境下簽名前顯示 decoded intent
- [x] `--yes` flag 跳過確認
- [x] Non-TTY（pipe/CI）自動跳過確認

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm test:unit` 全部通過（424 tests, 45 files）
- [x] `pnpm build` 成功

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| 7a. encode/decode | #1 | Medium | High（最大 DX 改善） |
| 7b. --output | #2 | Low | Medium |
| 7c. stdin | #3 | Low | Medium |
| 7d. permit simplify | #4 | Low | Medium |
| 7e. TTY confirm | #5 | Medium | High（安全性） |

## Open Decisions

| Decision | Options | Default | Resolution |
|----------|---------|---------|------------|
| Action Catalog 位置 | `src/protocols/catalog.ts` / decoders 內 | `src/protocols/catalog.ts` | ✅ `src/protocols/catalog.ts` |
| encode output | hex only / hex + intent JSON | hex only | ✅ `--output json`（預設 JSON with intent metadata）/ `--output raw`（hex only） |
| human-readable format | table / YAML-like / colored | Table | ✅ Aligned key-value table（`toHuman()`） |

## Dependencies

- Multi-Interface Architecture (Phase 6) -- Done
- Existing decoder ABIs (ERC-20, Uniswap V3) -- Done

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium reached |
| Development | Done | 7a-7e all implemented |
| Testing | Done | 424 tests across 45 files; 5 Codex review cycles passed |
| Acceptance | Done | All AC checked (7a 5/5, 7b 3/3, 7c 2/2, 7d 2/2, 7e 3/3, CI 3/3) |

## References

- Tech Spec: [../2-tech-spec.md](../2-tech-spec.md) (Phase 7)
- CLI Usage Examples: [../cli-usage-examples.md](../cli-usage-examples.md)
- Brainstorming: Codex thread `019c5a01-4b71-72f1-87fe-d55d291e5a74`
