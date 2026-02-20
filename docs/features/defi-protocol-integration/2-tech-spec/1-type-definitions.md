> [← Overview](./0-overview.md) | [Document Index](./0-overview.md#document-index)

## 3. Type Definitions

### 3.1 DecodedIntent

```typescript
// src/protocols/types.ts

import type { Address, Hex } from 'viem';

// -- Base fields shared by all decoded intents --
interface IntentBase {
  chainId: number;
  to: Address;
  selector: Hex;
}

// -- ERC-20 --
interface Erc20ApproveIntent extends IntentBase {
  protocol: 'erc20';
  action: 'approve';
  args: { spender: Address; amount: bigint };
}

interface Erc20TransferIntent extends IntentBase {
  protocol: 'erc20';
  action: 'transfer';
  args: { to: Address; amount: bigint };
}

// -- Uniswap V3 --
interface UniswapV3ExactInputSingleIntent extends IntentBase {
  protocol: 'uniswap_v3';
  action: 'exactInputSingle';
  args: {
    tokenIn: Address;
    tokenOut: Address;
    fee: number;
    recipient: Address;
    amountIn: bigint;
    amountOutMinimum: bigint;
    sqrtPriceLimitX96: bigint;
  };
}

// -- Aave V3 --
interface AaveV3SupplyIntent extends IntentBase {
  protocol: 'aave_v3';
  action: 'supply';
  args: { asset: Address; amount: bigint; onBehalfOf: Address; referralCode: number };
}

interface AaveV3BorrowIntent extends IntentBase {
  protocol: 'aave_v3';
  action: 'borrow';
  args: {
    asset: Address; amount: bigint; interestRateMode: bigint;
    referralCode: number; onBehalfOf: Address;
  };
}

interface AaveV3RepayIntent extends IntentBase {
  protocol: 'aave_v3';
  action: 'repay';
  args: { asset: Address; amount: bigint; interestRateMode: bigint; onBehalfOf: Address };
}

interface AaveV3WithdrawIntent extends IntentBase {
  protocol: 'aave_v3';
  action: 'withdraw';
  args: { asset: Address; amount: bigint; to: Address };
}

// -- Unknown (always rejected) --
interface UnknownIntent {
  protocol: 'unknown';
  chainId: number;
  to: Address;
  selector?: Hex;
  rawData: Hex;
  reason: string;
}

// -- Discriminated union --
export type DecodedIntent =
  | Erc20ApproveIntent
  | Erc20TransferIntent
  | UniswapV3ExactInputSingleIntent
  | AaveV3SupplyIntent
  | AaveV3BorrowIntent
  | AaveV3RepayIntent
  | AaveV3WithdrawIntent
  | UnknownIntent;

// -- Protocol decoder interface --
export interface ProtocolDecoder {
  readonly protocol: string;
  readonly supportedSelectors: readonly Hex[];
  decode(chainId: number, to: Address, data: Hex): DecodedIntent;
}
```

### 3.2 Contract Registry

```typescript
// src/protocols/registry.ts

import type { Address, Hex } from 'viem';
import type { ProtocolDecoder } from './types.js';

export interface ContractEntry {
  protocol: string;
  decoder: ProtocolDecoder;
}

export interface RegistryConfig {
  contracts: Record<string, ContractEntry>;  // key: `${chainId}:${lowercase address}`
  interfaceDecoders: ProtocolDecoder[];      // fallback: match by selector (e.g., ERC-20)
}

export class ProtocolRegistry {
  private readonly addressMap: Map<string, ContractEntry>;
  private readonly interfaceDecoders: ProtocolDecoder[];

  constructor(config: RegistryConfig) {
    this.addressMap = new Map(Object.entries(config.contracts));
    this.interfaceDecoders = config.interfaceDecoders;
  }

  /**
   * Lookup protocol by chainId + contract address (Stage 1).
   * Falls back to interface-based decoder matching by selector (Stage 2).
   */
  resolve(chainId: number, to: Address, selector: Hex): ProtocolDecoder | undefined {
    const key = `${chainId}:${to.toLowerCase()}`;
    const entry = this.addressMap.get(key);
    if (entry) return entry.decoder;

    const normalizedSelector = selector.toLowerCase() as Hex;
    return this.interfaceDecoders.find(
      (d) => d.supportedSelectors.some((s) => s.toLowerCase() === normalizedSelector),
    );
  }
}
```

### 3.3 Policy Engine V2

```typescript
// src/protocols/policy/types.ts

import type { Address } from 'viem';
import type { DecodedIntent } from '../types.js';

// -- V1 types (preserved, backward compatible) --
export interface PolicyConfig { /* ... existing ... */ }
export interface PolicyRequest { /* ... existing ... */ }
export interface PolicyEvaluation { /* ... existing ... */ }

// -- V2 extensions --
export interface PolicyRequestV2 extends PolicyRequest {
  intent?: DecodedIntent;
}

export interface ProtocolPolicyConfig {
  tokenAllowlist?: Address[];
  recipientAllowlist?: Address[];
  maxSlippageBps?: number;
  maxInterestRateMode?: number;
  maxAllowanceWei?: bigint;
}

export interface PolicyConfigV2 extends PolicyConfig {
  protocolPolicies?: Record<string, ProtocolPolicyConfig>;  // key: protocol name
}

// -- Protocol evaluator interface --
// Returns string[] (violations), not PolicyEvaluation — engine aggregates violations.
export interface ProtocolPolicyEvaluator {
  readonly protocol: string;
  evaluate(intent: DecodedIntent, config: ProtocolPolicyConfig): string[];
}
```
