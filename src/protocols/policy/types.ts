import type { Address } from 'viem';
import type { DecodedIntent } from '../types.js';

// -- V1 types (preserved, backward compatible) --

export interface PolicyConfig {
  allowedChainIds: number[];
  allowedContracts: `0x${string}`[]; // lowercase
  allowedSelectors: `0x${string}`[]; // 4-byte function selectors
  maxAmountWei: bigint;
  maxDeadlineSeconds: number; // max seconds from now
}

export interface PolicyRequest {
  chainId: number;
  to: `0x${string}`;
  selector?: `0x${string}`;
  amountWei?: bigint;
  deadline?: number; // unix timestamp
}

export interface PolicyEvaluation {
  allowed: boolean;
  violations: string[];
}

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
  protocolPolicies?: Record<string, ProtocolPolicyConfig>; // key: protocol name
}

// -- Protocol evaluator interface --
// Returns string[] (violations), not PolicyEvaluation — engine aggregates violations.
export interface ProtocolPolicyEvaluator {
  readonly protocol: string;
  evaluate(intent: DecodedIntent, config: ProtocolPolicyConfig): string[];
}
