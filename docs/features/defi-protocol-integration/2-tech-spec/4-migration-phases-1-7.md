> [← Overview](./0-overview.md) | [Document Index](./0-overview.md#document-index)

## 9. Migration Plan

### Phase 1: Protocol Decoder Framework + Policy V1 Migration ✅

1. Create `src/protocols/` module (types, registry, dispatcher)
2. Move `src/agentic/policy/` → `src/protocols/policy/` (evolve V1 → V2 in place)
3. Add `src/agentic/policy/` re-export bridge (deprecated)
4. Add `./protocols` subpath to `package.json`
5. Update trust boundary test + ESLint config
6. Update `src/agentic/index.ts` re-exports

### Phase 2: ERC-20 Decoder + Evaluator ✅

1. Add `src/protocols/decoders/erc20.ts`
2. Add `src/protocols/policy/evaluators/erc20.ts`
3. Unit tests for decoder and evaluator
4. Update `loadPolicyConfig()` in `cli.ts` to parse V2 fields

### Phase 3: MCP Tools + Uniswap V3 ✅ (CLI wiring deferred to Phase 5c)

1. Add `sign_defi_call` MCP tool
2. Upgrade `sign_swap` to use decoder pipeline
   - **Breaking behavior change**: Short/undecodable calldata (currently accepted) will be rejected. Intentional for security (fail-closed).
3. Add Uniswap V3 decoder + evaluator
4. Update `ToolContext` with optional `dispatcher`; `createMcpServer` injects default
5. Update tool registration in `index.ts`

> **Note**: Uniswap V3 decoder/evaluator 完成。CLI evaluator 接線原延至 Phase 5c，已於 Phase 5 完成。`createMcpServer` 和 CLI 路徑均已正確接線。

### Phase 4: Aave V3 ✅

1. Added Aave V3 decoder (supply/borrow/repay/withdraw) — `src/protocols/decoders/aave-v3.ts`
2. Added Aave V3 policy evaluator — `src/protocols/policy/evaluators/aave-v3.ts`
3. Registered Aave V3 contracts in registry (mainnet + Sepolia)
4. Unit tests for all Aave actions (decoder + evaluator)
5. Updated Protocol Action Catalog with 4 Aave V3 actions
6. Sepolia E2E test: Wrap → Swap → Supply full DeFi flow with KMS signing (`test/integration/sepolia-defi-flow.test.ts`)

### Phase 5: Security Hardening + Code Quality

> 來源：Phase 3 完成後的對抗式 brainstorming（Claude + Codex 獨立研究）

#### 5a. `sign_permit` message-vs-args bypass 修復 ✅

以 EIP-712 `message` 為 single source of truth，嚴格比對 `value`, `spender`, `deadline` 一致性（`sign-permit.ts:126`）。

#### 5b. MCP Input Schema 結構驗證 ✅

加入 zod refinement — `zodHexAddress`、`zodHexData`、`zodPositiveChainId`（`shared.ts:9-21`）。

#### 5c. CLI Evaluator 接線補全 ✅

CLI 已註冊 `erc20Evaluator` 和 `uniswapV3Evaluator`（`cli.ts:116`）。

#### 5d. `sign_swap` / `sign_defi_call` 重複消除 ✅

已提取共用 `executeDecodedCallPipeline` helper（`decoded-call-pipeline.ts`），兩個 tool handler 均呼叫此 helper。Phase 6a 將進一步提取至 workflow layer。

#### 5e. PolicyEngine `Set` 預處理 ✅

Constructor 已預處理 `allowedChainIds`、`allowedContracts`、`allowedSelectors` 為 `Set`（`engine.ts:21-23`）。

### Phase 6: Multi-Interface Architecture (Workflow + CLI) ✅

> 來源：Phase 5 完成後的多介面 brainstorming（Claude + Codex Nash Equilibrium）

#### 6a. Extract Workflow Layer ✅

1. Created `src/protocols/workflows/types.ts`（AuditSink, WorkflowContext, domain result types）
2. Created `src/protocols/workflows/sign-defi-call.ts`（從 `decoded-call-pipeline.ts` 提取）
3. Created `src/protocols/workflows/sign-permit.ts`（從 `sign-permit.ts` 提取 security logic）
4. Created `src/protocols/workflows/get-address.ts` + `health-check.ts`
5. MCP tools 重構為 thin adapters + `result-adapter.ts` 共用 converter
6. 375 unit + 12 E2E tests 全部通過

#### 6b. CLI Entry ✅

1. Created `src/cli/index.ts`（手動 switch routing，零依賴）
2. 實作 6 subcommands: `sign`, `sign-permit`, `dry-run`, `get-address`, `health`, `mcp`
3. `mcp` subcommand 呼叫既有 `startStdioServer`
4. `package.json` 新增 `agentic-vault` + `agentic-vault-mcp` 雙 bin entry
5. CLI commands 呼叫 workflows with `caller: 'cli'`
6. 9 CLI test files + 3 trust boundary tests

#### 6c. SDK Export ✅

1. Workflows exported via `./protocols` subpath
2. `./protocols` subpath 不拉入 MCP/CLI 依賴（trust boundary test 驗證）

### Phase 7: CLI UX Improvements ✅

> 來源：Phase 6b 完成後的 CLI 介面體驗 brainstorming（Claude + Codex Nash Equilibrium，Codex thread: `019c5a01-4b71-72f1-87fe-d55d291e5a74`）
> 詳見 [request doc](../requests/archive/2026-02-13-cli-ux-improvements.md)

#### 7a. `encode` / `decode` Subcommands（Priority #1）

目前使用者必須手動組裝 raw hex calldata（`--data 0x095ea7b3...`），DX 門檻高。新增 `encode` / `decode` subcommands，復用既有 decoder ABIs：

```bash
# encode: intent → calldata hex
agentic-vault encode erc20:approve \
  --spender 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 \
  --amount 1000000
# → 0x095ea7b3000000000000000000000000...

# decode: calldata hex → intent JSON
agentic-vault decode \
  --chain-id 1 \
  --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --data 0x095ea7b3...
# → { "protocol": "erc20", "action": "approve", ... }
```

核心概念：**Protocol Action Catalog** — 共用 ABI metadata 讓 decoder 和 encoder 使用同一來源，避免 drift。

```typescript
// src/protocols/catalog.ts
export interface ProtocolAction {
  protocol: string;
  action: string;
  selector: Hex;
  abi: AbiFunction;
  paramNames: string[];   // CLI flag names
}

export const ACTION_CATALOG: Record<string, ProtocolAction> = {
  'erc20:approve': { protocol: 'erc20', action: 'approve', selector: '0x095ea7b3', ... },
  'erc20:transfer': { protocol: 'erc20', action: 'transfer', selector: '0xa9059cbb', ... },
  'uniswap_v3:exactInputSingle': { ... },
};
```

#### 7b. `--output` Global Flag

```bash
agentic-vault dry-run --output json ...    # JSON（目前預設）
agentic-vault dry-run --output human ...   # Human-readable table
agentic-vault dry-run --output raw ...     # Raw hex only
```

#### 7c. stdin Support

```bash
# Pipe calldata from other tools
cast calldata "approve(address,uint256)" 0x... 1000000 | agentic-vault sign --chain-id 1 --to 0x... --data -
echo '0x095ea7b3...' | agentic-vault decode --chain-id 1 --to 0x...
```

#### 7d. Permit Simplification

```bash
# 目前需要 6 個 flags + --payload JSON file
# 簡化為 --file primary（自動從 JSON 提取所有欄位）
agentic-vault sign-permit --key-id ... --region ... --file permit.json
```

#### 7e. Interactive TTY Confirmation

```bash
# TTY 環境下簽名前顯示 intent 並要求確認
agentic-vault sign --chain-id 1 --to 0x... --data 0x...
#  Protocol: ERC-20
#  Action:   approve
#  Spender:  0x68b3...Fc45
#  Amount:   1,000,000 (1 USDC)
#
#  Sign this transaction? [y/N]

# Non-interactive（CI/pipe）自動跳過（stdin+stdout 雙向 TTY 檢測）
agentic-vault sign --yes --chain-id 1 ...
```
