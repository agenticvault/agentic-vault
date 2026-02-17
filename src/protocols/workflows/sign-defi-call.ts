import type { WorkflowContext, WorkflowResult } from './types.js';

export interface SignDefiCallInput {
  chainId: number;
  to: string;
  data: string;
  value?: string;
}

const DEFAULT_SERVICE = 'agentic-vault';

/**
 * Decode → fail-closed reject → policy → sign workflow.
 *
 * Interface-agnostic: callers provide WorkflowContext with their own
 * AuditSink, caller tag, and service name.
 */
export async function signDefiCall(
  ctx: WorkflowContext,
  actionName: string,
  input: SignDefiCallInput,
): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;
  const to = input.to.toLowerCase() as `0x${string}`;
  const data = input.data as `0x${string}`;

  // 1. Require dispatcher
  if (!ctx.dispatcher) {
    throw new Error(`${actionName} requires dispatcher in WorkflowContext`);
  }

  // 2. Decode calldata
  const intent = ctx.dispatcher.dispatch(input.chainId, to, data);

  // 3. Reject unknown protocols (fail-closed)
  if (intent.protocol === 'unknown') {
    ctx.auditSink.log({
      service,
      action: actionName,
      who: ctx.caller,
      what: `Rejected unknown calldata for ${to} on chain ${input.chainId}`,
      why: `Decoder rejection: ${intent.reason}`,
      result: 'denied',
      details: { chainId: input.chainId, to, reason: intent.reason },
    });
    return {
      status: 'denied',
      reason: `Rejected: ${intent.reason}`,
    };
  }

  // 4. Parse value
  let amountWei: bigint | undefined;
  if (input.value) {
    try {
      amountWei = BigInt(input.value);
    } catch {
      ctx.auditSink.log({
        service,
        action: actionName,
        who: ctx.caller,
        what: `Invalid value parameter for ${to} on chain ${input.chainId}`,
        why: 'Input validation: value must be a decimal string',
        result: 'error',
        details: { chainId: input.chainId, to },
      });
      return {
        status: 'error',
        reason: 'Invalid value: must be a decimal string',
      };
    }
  }

  // 5. Policy evaluation with decoded intent
  const evaluation = ctx.policyEngine.evaluate({
    chainId: input.chainId,
    to,
    selector: intent.selector,
    amountWei,
    intent,
  });

  if (!evaluation.allowed) {
    ctx.auditSink.log({
      service,
      action: actionName,
      who: ctx.caller,
      what: `Policy denied ${intent.protocol}:${intent.action} on chain ${input.chainId}`,
      why: `Violations: ${evaluation.violations.join('; ')}`,
      result: 'denied',
      details: {
        chainId: input.chainId,
        to,
        protocol: intent.protocol,
        action: intent.action,
        violations: evaluation.violations,
      },
    });
    return {
      status: 'denied',
      reason: `Policy denied: ${evaluation.violations.join('; ')}`,
      violations: evaluation.violations,
    };
  }

  // 6. Dry-run: return decoded intent + policy evaluation without signing
  if (ctx.dryRun) {
    ctx.auditSink.log({
      service,
      action: actionName,
      who: ctx.caller,
      what: `Dry-run approved ${intent.protocol}:${intent.action} on chain ${input.chainId}`,
      why: 'Approved by decoder + policy (dry-run)',
      result: 'approved',
      details: { chainId: input.chainId, to, protocol: intent.protocol, action: intent.action, dryRun: true },
    });
    return {
      status: 'dry-run-approved',
      details: {
        protocol: intent.protocol,
        action: intent.action,
        chainId: input.chainId,
        to,
        intent,
        evaluation: { allowed: true, violations: [] },
      },
    };
  }

  // 7. Sign
  if (!ctx.signer) {
    ctx.auditSink.log({
      service,
      action: actionName,
      who: ctx.caller,
      what: 'Signer not available for signing',
      why: 'Configuration error: signer is required when dryRun is not enabled',
      result: 'error',
    });
    return { status: 'error', reason: 'Signer is required when dryRun is not enabled' };
  }

  try {
    const signedTx = await ctx.signer.signTransaction({
      chainId: input.chainId,
      to,
      data,
      value: amountWei,
    });

    ctx.auditSink.log({
      service,
      action: actionName,
      who: ctx.caller,
      what: `Signed ${intent.protocol}:${intent.action} for ${to} on chain ${input.chainId}`,
      why: 'Approved by decoder + policy',
      result: 'approved',
      details: { chainId: input.chainId, to, protocol: intent.protocol, action: intent.action },
    });

    return {
      status: 'approved',
      data: signedTx,
      details: { protocol: intent.protocol, action: intent.action },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: actionName,
      who: ctx.caller,
      what: `Failed to sign ${intent.protocol}:${intent.action}`,
      why: 'Signing error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: `Signing error: ${msg}` };
  }
}
