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

/** Full context for workflow execution */
export interface WorkflowContext {
  signer?: WorkflowSigner;
  policyEngine: WorkflowPolicyEngine;
  auditSink: AuditSink;
  dispatcher?: WorkflowDispatcher;
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
