# DeFi Protocol Integration — Feasibility Study

## 1. Problem Decomposition (5 Why)

| Level | Question | Answer |
|-------|----------|--------|
| Why 1 | Why do we want DeFi integration? | AI agent needs to execute on-chain DeFi operations (swap, lend, borrow) via vault wallet |
| Why 2 | Why can't current architecture handle it? | `sign_swap` accepts pre-built calldata blindly — no semantic validation, no protocol awareness |
| Why 3 | Why is blind calldata signing a problem? | Policy engine can't enforce meaningful guardrails (slippage, amount, token allowlists) on opaque bytes |
| Why 4 | Why does the wallet need protocol awareness? | To validate intent matches calldata, prevent prompt-injection-driven malicious transactions |
| Why 5 | Why not just trust the AI agent? | AI agents are susceptible to prompt injection; the signing layer is the last line of defense |

**Essence**: Build a calldata-aware signing layer with DeFi protocol knowledge for policy enforcement, while keeping the core signing pure.

## 2. Success Criteria

| Criteria | Metric |
|----------|--------|
| Protocol coverage | ERC-20 + Uniswap V3 + Aave V3 supported |
| Policy enforcement | Decoded-arg-level validation (not just selector) |
| Dependency budget | Max 1 new runtime dependency |
| Core isolation | `src/core/` unchanged |
| Backward compatibility | Existing `sign_swap` / `sign_permit` tools preserved (internally upgraded to use decoder) |
| Fail-closed security | Unknown/undecodable calldata is **rejected**, never signed |

## 3. Constraints

| Constraint | Type | Flexibility |
|-----------|------|-------------|
| Trust boundary: `src/agentic/` cannot import from internal modules | Technical | Hard |
| Wallet is a pure signer (no broadcast, no RPC reads) | Architecture | Medium |
| viem as sole EVM library | Technical | Soft |
| No ABI/calldata infrastructure (aside from selector extraction in `sign-swap.ts:18`) | Technical | Needs building |
| MCP tool surface stability (skills reference tool names) | API | Medium |
| `@aave/contract-helpers` deprecated (Jan 2026) | External | Hard — cannot use |

## 4. SDK/API Landscape

### Uniswap

| Package | Version | Dependency | Fit |
|---------|---------|-----------|-----|
| [`@uniswap/universal-router-sdk`](https://www.npmjs.com/package/@uniswap/universal-router-sdk) | 4.19.x | ethers v5 transitive | Calldata generation + routing |
| [`@uniswap/v3-sdk`](https://www.npmjs.com/package/@uniswap/v3-sdk) | 3.27.x | `@uniswap/sdk-core` | Pool math, trade construction |
| [`@uniswap/sdk-core`](https://www.npmjs.com/package/@uniswap/sdk-core) | 7.10.x | minimal | Token/price abstractions |
| viem `encodeFunctionData` | built-in | none | ABI encode/decode with type safety |

### Aave

| Package | Version | Status | Fit |
|---------|---------|--------|-----|
| [`@aave/contract-helpers`](https://github.com/aave/aave-utilities) | 5.x | **Deprecated/archived** (Jan 2026) | ❌ Cannot use |
| [`@aave/client`](https://aave.com/docs/aave-v3/getting-started/typescript) (AaveKit) | early | viem-inspired, Node >= v22 | External use only |
| viem + Aave Pool ABI | built-in | stable | Encode/decode Pool methods |

### viem Native Capabilities

| Function | Purpose | Protocol Use |
|----------|---------|-------------|
| [`encodeFunctionData`](https://viem.sh/docs/contract/encodeFunctionData) | Build calldata from ABI + args | Construction |
| [`decodeFunctionData`](https://viem.sh/docs/contract/decodeFunctionData) | Decode calldata back to function + args | **Validation** |
| `parseAbi` / `const abi = [...]` | Type-safe ABI definitions | Both |

**Key Insight**: viem already has everything needed for calldata construction AND validation. No external SDK required for the signing wallet.

## 5. Solutions

**Scoring rubric** — all dimensions: higher = better (5 = best outcome).

| Dimension | 1 (worst) | 5 (best) |
|-----------|-----------|----------|
| Feasibility | Blocked by hard constraints | Fully achievable with existing tools |
| Effort | 12+ weeks | < 2 weeks |
| Risk | High probability of failure / security gaps | Minimal risk |
| Extensibility | Requires architecture changes for new protocols | Add new module, register, done |
| Maintenance | Frequent breaking changes / dep churn | Stable, low-touch |

### Solution A: viem-Native Only (Zero New Dependencies)

Use viem's `encodeFunctionData` / `decodeFunctionData` with protocol ABI fragments defined as `const` arrays.

```
src/agentic/protocols/
├── types.ts             # DecodedIntent discriminated union
├── registry.ts          # chainId+address → protocol lookup
├── dispatcher.ts        # decodeTx() orchestration
├── erc20.ts             # ERC-20 ABI fragments + decoder + validator
├── uniswap-v3.ts        # Uniswap V3 SwapRouter ABI + decoder + validator
└── aave-v3.ts           # Aave V3 Pool ABI + decoder + validator
```

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Feasibility | 5 | viem already supports all needed ops |
| Effort | 3 | ~3-4 weeks for 3 protocols |
| Risk | 2 | Low — no external dep risk |
| Extensibility | 4 | Add new protocol = add new module |
| Maintenance | 4 | Own ABI fragments, but core ABIs are stable |
| **Total** | **18/25** | |

### Solution B: Protocol SDKs (External Construction)

Use `@uniswap/universal-router-sdk` for swap calldata, `@aave/client` for Aave.

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Feasibility | 3 | Aave SDK deprecated; Uniswap SDK has ethers dep |
| Effort | 2 | Integration + adapter work + dep conflicts |
| Risk | 4 | SDK churn, dep conflicts, type mismatches |
| Extensibility | 3 | Tied to SDK release cycles |
| Maintenance | 2 | SDK breaking changes propagate |
| **Total** | **14/25** | |

### Solution C: Hybrid — viem-Native Wallet + External SDK Router (Recommended)

**Wallet (this repo)**: viem-native decode+validate only. No calldata construction.
**External (separate MCP/service)**: Uniswap SDK for routing/quoting, any Aave SDK for suggestions.

```
┌─────────────────────────────────────────────────────┐
│                    AI Agent (LLM)                    │
│  "Swap 100 USDC → ETH on Uniswap, max 0.5% slip"  │
└────────────┬─────────────────────────┬──────────────┘
             │                         │
   ┌─────────▼──────────┐   ┌─────────▼──────────────┐
   │  defi-router (ext)  │   │  agentic-vault-wallet   │
   │                     │   │                         │
   │ • Uniswap SDK       │   │ • decode calldata       │
   │ • Quote/route       │   │ • validate decoded args │
   │ • Build calldata    │   │ • policy evaluate       │
   │ • Suggest params    │   │ • sign if approved      │
   └─────────┬───────────┘   │ • audit log             │
             │ calldata      └────────┬────────────────┘
             └────────────────────────→ verify → sign
```

Wallet-side architecture (viem-native):

```typescript
// DecodedIntent — discriminated union (per-action arg shapes)
type DecodedIntent =
  // ERC-20
  | { protocol: 'erc20'; action: 'approve';
      args: { spender: Address; amount: bigint } }
  | { protocol: 'erc20'; action: 'transfer';
      args: { to: Address; amount: bigint } }
  // Uniswap V3 (SwapRouter02 — IV3SwapRouter, no deadline in params)
  | { protocol: 'uniswap_v3'; action: 'exactInputSingle';
      args: { tokenIn: Address; tokenOut: Address; fee: number;
              recipient: Address; amountIn: bigint;
              amountOutMinimum: bigint; sqrtPriceLimitX96: bigint } }
  // Aave V3 Pool — per-action shapes
  | { protocol: 'aave_v3'; action: 'supply';
      args: { asset: Address; amount: bigint; onBehalfOf: Address; referralCode: number } }
  | { protocol: 'aave_v3'; action: 'borrow';
      args: { asset: Address; amount: bigint; interestRateMode: bigint;
              referralCode: number; onBehalfOf: Address } }
  | { protocol: 'aave_v3'; action: 'repay';
      args: { asset: Address; amount: bigint; interestRateMode: bigint;
              onBehalfOf: Address } }
  | { protocol: 'aave_v3'; action: 'withdraw';
      args: { asset: Address; amount: bigint; to: Address } }
  // Unknown — hard reject, never signed
  | { protocol: 'unknown'; rawData: Hex; reason: string };
```

**Security invariant**: `protocol: 'unknown'` intents are **always rejected**. There is no fallback to raw/legacy signing.

Decoder dispatch strategy — 2-stage:
1. **Stage 1**: `chainId + to` → known protocol contract?
2. **Stage 2**: 4-byte selector → decode function args via viem ABI

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Feasibility | 5 | viem-native wallet + external SDK where needed |
| Effort | 3 | ~3-4 weeks wallet-side, external router separate |
| Risk | 1 | Minimal — zero new wallet deps |
| Extensibility | 5 | Add protocol module + register; external router independent |
| Maintenance | 5 | ABI fragments stable; SDK churn isolated to external |
| **Total** | **19/25** | |

## 6. Comparison

| Criteria | A: viem-Only | B: Protocol SDKs | C: Hybrid (Recommended) |
|----------|-------------|-----------------|------------------------|
| New wallet deps | 0 | 2-3 | 0 |
| Calldata construction | Wallet builds | SDK builds | External builds |
| Calldata validation | Wallet decodes | SDK + wallet | Wallet decodes |
| Routing/quoting | None | Built-in | External |
| Type safety | Best (viem inference) | Mixed | Best (wallet viem) |
| `@aave/contract-helpers` | Not needed | ❌ Deprecated | Not needed |
| Protocol upgrade risk | Own ABI fragments | SDK dep | ABI fragments (stable) |
| AI agent UX | Needs calldata from agent | SDK handles | External router helps |
| **Score** | **18/25** | **14/25** | **19/25** |

## 7. Claude vs Codex Disagreement Log

| Topic | Claude Initial | Codex Position | Resolution |
|-------|---------------|----------------|------------|
| Fat vs thin wallet | Thin wallet (decode only) | Thin wallet with strong semantic validation | Aligned — thin wallet + deep validation |
| MCP tool explosion | Add per-protocol tools | Keep `sign_swap` + add generic `sign_defi_call` | Codex approach — fewer tools, decoder handles protocol dispatch. `sign_swap` internally upgraded to use decoder pipeline. |
| Policy engine V2 | Expand PolicyRequest with optional fields | Protocol-specific evaluators via dispatcher | Codex approach — avoids field bloat, exhaustive switch checks |
| Decoder dispatch | Selector-based | 2-stage: address-first, selector-second | Codex approach — address is stronger trust signal |
| `DecodedIntent` type | Generic with metadata | Discriminated union per protocol | Codex approach — compile-time exhaustiveness |

## 8. Recommendation

**Solution C: Hybrid** — viem-native wallet + external DeFi router.

### Legacy Tool Migration: `sign_swap`

`sign_swap` is **preserved** but internally upgraded to route through the decoder+policy pipeline:

```
Before: sign_swap → extract selector → flat policy check → sign
After:  sign_swap → decoder.dispatch(chainId, to, data) → DecodedIntent → policy V2 evaluate → sign
```

If the decoder cannot decode the calldata (returns `protocol: 'unknown'`), signing is **rejected**. This closes the bypass path.

### Policy Engine V2 Migration

Current `PolicyRequest` (`src/agentic/policy/types.ts`):

```typescript
// V1 — flat, selector-level
interface PolicyRequest {
  chainId: number; to: Hex; selector?: Hex; amountWei?: bigint; deadline?: number;
}
```

Proposed V2 — intent-aware with backward compatibility:

```typescript
// V2 — extends V1 with optional decoded intent
interface PolicyRequestV2 extends PolicyRequest {
  intent?: DecodedIntent;  // from decoder, undefined for legacy callers
}

// Protocol-specific evaluator registration
interface ProtocolPolicyEvaluator {
  protocol: string;
  evaluate(intent: DecodedIntent, config: ProtocolPolicyConfig): PolicyEvaluation;
}

// Per-protocol config (extends base PolicyConfig)
interface ProtocolPolicyConfig {
  tokenAllowlist?: Address[];    // allowed token contracts
  recipientAllowlist?: Address[]; // allowed recipients (self, known EOAs)
  maxSlippageBps?: number;        // max slippage in basis points
  maxInterestRateMode?: number;   // Aave: 1=stable, 2=variable
}
```

Migration path:
1. `PolicyEngine.evaluate()` checks if `intent` is present
2. If yes → dispatch to registered `ProtocolPolicyEvaluator`
3. If no → fall back to V1 flat checks (backward compatible)
4. `ToolPolicyEngine` interface in `shared.ts` updated to accept `intent?`

### Implementation Phases

| Phase | Scope | Effort | Dependencies |
|-------|-------|--------|-------------|
| P1 | Protocol decoder framework + ERC-20 | 1 week | None |
| P2 | Policy engine V2 (intent-aware) | 1 week | P1 |
| P3 | Uniswap V3 decoder + `sign_defi_call` tool | 1-2 weeks | P1, P2 |
| P4 | Aave V3 decoder (supply/withdraw/borrow/repay) | 1-2 weeks | P1, P2 |
| P5 | External DeFi router MCP (separate repo) | 2-3 weeks | Independent |

### Aave V3 Pool ABI Reference (viem-native)

Source: [`IPool.sol`](https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol)

```typescript
const aavePoolAbi = [
  { name: 'supply', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ], outputs: [] },
  { name: 'borrow', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' },
    ], outputs: [] },
  { name: 'repay', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
    ], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ], outputs: [{ name: '', type: 'uint256' }] },
] as const;
```

### Uniswap V3 SwapRouter02 ABI Reference

Target contract: **SwapRouter02** (`IV3SwapRouter`) — the newer periphery router used on mainnet.
Note: The legacy `ISwapRouter` includes `deadline` in the params struct; `IV3SwapRouter` does not. Deadline checks are available via `MulticallExtended.multicall(uint256 deadline, bytes[] calldata)`, but are **not guaranteed** for all call paths (e.g., direct `exactInputSingle` calls bypass deadline). The wallet's policy engine should enforce its own deadline bounds independently.

Source: [`IV3SwapRouter.sol`](https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol)

```typescript
const uniswapV3SwapRouterAbi = [
  { name: 'exactInputSingle', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }] },
] as const;
```

## 9. Open Questions

| Question | Impact | When to Decide |
|----------|--------|---------------|
| Should `sign_defi_call` require `expectedProtocol` hint from caller? | UX vs security | P3 |
| Multi-chain contract registry — hardcoded or config file? | Deployment flexibility | P1 |
| External DeFi router: separate MCP server or same process? | Architecture | P5 |
| Uniswap V4 Universal Router support timeline | Scope | Post-P4 |

**Decided**: Unknown/undecodable calldata is **always rejected** (fail-closed). No fallback to raw signing.

## 10. Sources

- [Uniswap V3 SDK](https://docs.uniswap.org/sdk/v3/overview)
- [Uniswap Universal Router SDK](https://www.npmjs.com/package/@uniswap/universal-router-sdk)
- [Aave V3 Pool Contract](https://aave.com/docs/aave-v3/smart-contracts/pool)
- [Aave Utilities (deprecated)](https://github.com/aave/aave-utilities)
- [AaveKit TypeScript](https://aave.com/docs/aave-v3/getting-started/typescript)
- [viem `encodeFunctionData`](https://viem.sh/docs/contract/encodeFunctionData)
- [viem `decodeFunctionData`](https://viem.sh/docs/contract/decodeFunctionData)
