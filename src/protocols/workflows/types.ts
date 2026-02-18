/** Caller identity for audit trail */
export type WorkflowCaller = 'mcp-client' | 'cli' | 'sdk' | 'openclaw';

/** Audit sink interface — consumers inject their own implementation */
export interface AuditSink {
  log(entry: {
    service: string;
    action: string;
    who: string;
    what: string;
    why: string;
    result: 'approved' | 'denied' | 'error';
    details?: Record<string, unknown>;
  }): unknown;
}

/** Minimal signer interface for workflows */
export interface WorkflowSigner {
  getAddress(): Promise<`0x${string}`>;
  signTransaction(tx: Record<string, unknown>): Promise<`0x${string}`>;
  signTypedData(params: Record<string, unknown>): Promise<{
    v: number;
    r: `0x${string}`;
    s: `0x${string}`;
  }>;
  healthCheck(): Promise<void>;
}

/** Decoded intent from protocol dispatcher */
export interface WorkflowDecodedIntent {
  protocol: string;
  chainId: number;
  to: `0x${string}`;
  selector?: `0x${string}`;
  action?: string;
  args?: Record<string, unknown>;
  reason?: string;
}

/** Minimal policy engine interface for workflows */
export interface WorkflowPolicyEngine {
  evaluate(request: {
    chainId: number;
    to: `0x${string}`;
    selector?: `0x${string}`;
    amountWei?: bigint;
    deadline?: number;
    intent?: WorkflowDecodedIntent;
  }): { allowed: boolean; violations: string[] };
}

/** Protocol dispatcher interface for calldata decoding */
export interface WorkflowDispatcher {
  dispatch(
    chainId: number,
    to: `0x${string}`,
    data: `0x${string}`,
  ): WorkflowDecodedIntent;
}

/** RPC provider interface for on-chain reads and broadcast */
export interface WorkflowRpcProvider {
  getBalance(chainId: number, address: `0x${string}`): Promise<bigint>;
  getErc20Balance(chainId: number, token: `0x${string}`, owner: `0x${string}`): Promise<bigint>;
  getTransactionCount(chainId: number, address: `0x${string}`): Promise<number>;
  estimateGas(chainId: number, tx: { from: `0x${string}`; to: `0x${string}`; value?: bigint; data?: `0x${string}` }): Promise<bigint>;
  getGasPrice(chainId: number): Promise<bigint>;
  estimateFeesPerGas(chainId: number): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
  getNativeCurrencySymbol(chainId: number): string;
  sendRawTransaction(chainId: number, signedTx: `0x${string}`): Promise<`0x${string}`>;
}

/** Full context for workflow execution */
export interface WorkflowContext {
  signer?: WorkflowSigner;
  policyEngine: WorkflowPolicyEngine;
  auditSink: AuditSink;
  dispatcher?: WorkflowDispatcher;
  rpcProvider?: WorkflowRpcProvider;
  caller: WorkflowCaller;
  service?: string;
  dryRun?: boolean;
}

/** Discriminated union for workflow results */
export type WorkflowResult =
  | { status: 'approved'; data: string; details?: Record<string, unknown> }
  | { status: 'dry-run-approved'; details: Record<string, unknown> }
  | { status: 'denied'; reason: string; violations?: string[] }
  | { status: 'error'; reason: string };

const DECIMAL_ONLY = /^-?\d+$/;

/**
 * Parse a string as a decimal-only BigInt.
 * Rejects hex (0x), binary (0b), octal (0o) prefixes that BigInt() silently accepts.
 * Allows an optional leading minus sign so callers can provide specific negative-value errors.
 */
export function parseDecimalBigInt(value: string): bigint {
  if (!DECIMAL_ONLY.test(value)) {
    throw new Error('Value must be a decimal string (0-9 only)');
  }
  return BigInt(value);
}
