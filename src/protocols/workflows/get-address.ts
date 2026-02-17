import type { WorkflowContext, WorkflowResult } from './types.js';

const DEFAULT_SERVICE = 'agentic-vault';

export async function getAddress(ctx: WorkflowContext): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;

  if (!ctx.signer) {
    ctx.auditSink.log({
      service,
      action: 'get_address',
      who: ctx.caller,
      what: 'Signer not available for address lookup',
      why: 'Configuration error: signer is required',
      result: 'error',
    });
    return { status: 'error', reason: 'Signer is required for get_address' };
  }

  try {
    const address = await ctx.signer.getAddress();

    ctx.auditSink.log({
      service,
      action: 'get_address',
      who: ctx.caller,
      what: `Retrieved wallet address: ${address}`,
      why: 'Address lookup requested',
      result: 'approved',
    });

    return { status: 'approved', data: address };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'get_address',
      who: ctx.caller,
      what: 'Failed to retrieve wallet address',
      why: 'Address lookup error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: msg };
  }
}
