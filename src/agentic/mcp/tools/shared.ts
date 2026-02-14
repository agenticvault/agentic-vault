import { z } from 'zod';

/**
 * Shared Zod schema refinements for MCP tool inputs.
 * Validates hex format and address structure at the schema boundary.
 */
const HEX_RE = /^0x[0-9a-fA-F]*$/;

export const zodHexAddress = z.string().refine(
  (v) => HEX_RE.test(v) && v.length === 42,
  { message: 'Invalid address: must be 0x-prefixed 42-character hex string' },
);

export const zodHexData = z.string().refine(
  (v) => HEX_RE.test(v) && v.length % 2 === 0,
  { message: 'Invalid hex data: must be 0x-prefixed even-length hex string' },
);

export const zodPositiveChainId = z.number().int().positive({
  message: 'Invalid chainId: must be a positive integer',
});

/**
 * Tool context types — defined locally to avoid trust boundary violations.
 * Uses structural typing so callers can pass the actual implementations.
 */

/** Minimal decoded intent — structural supertype of the protocol layer's DecodedIntent union */
export interface ToolDecodedIntent {
  protocol: string;
  chainId: number;
  to: `0x${string}`;
  selector?: `0x${string}`;
  action?: string;
  args?: Record<string, unknown>;
  rawData?: `0x${string}`;
  reason?: string;
}

/** Minimal signer interface needed by MCP tools */
export interface ToolSigner {
  getAddress(): Promise<`0x${string}`>;
  signTransaction(tx: Record<string, unknown>): Promise<`0x${string}`>;
  signTypedData(params: Record<string, unknown>): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }>;
  healthCheck(): Promise<void>;
}

/** Policy evaluation result */
export interface ToolPolicyEvaluation {
  allowed: boolean;
  violations: string[];
}

/** Minimal policy engine interface needed by MCP tools (V2 — intent-aware) */
export interface ToolPolicyEngine {
  evaluate(request: {
    chainId: number;
    to: `0x${string}`;
    selector?: `0x${string}`;
    amountWei?: bigint;
    deadline?: number;
    intent?: ToolDecodedIntent;
  }): ToolPolicyEvaluation;
}

/** Protocol dispatcher interface for calldata decoding */
export interface ToolDispatcher {
  dispatch(chainId: number, to: `0x${string}`, data: `0x${string}`): ToolDecodedIntent;
}

/** Audit entry fields that callers provide (timestamp and traceId auto-generated) */
export interface ToolAuditInput {
  service: string;
  action: string;
  who: string;
  what: string;
  why: string;
  result: 'approved' | 'denied' | 'error';
  details?: Record<string, unknown>;
}

/** Minimal audit logger interface needed by MCP tools */
export interface ToolAuditLogger {
  log(entry: ToolAuditInput): unknown;
}

/** Full context passed to each MCP tool */
export interface ToolContext {
  signer: ToolSigner;
  policyEngine: ToolPolicyEngine;
  auditLogger: ToolAuditLogger;
  dispatcher?: ToolDispatcher;
}
