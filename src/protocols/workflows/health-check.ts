import type { WorkflowContext, WorkflowResult } from './types.js';

const DEFAULT_SERVICE = 'agentic-vault';

export async function healthCheck(ctx: WorkflowContext): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;

  if (!ctx.signer) {
    ctx.auditSink.log({
      service,
      action: 'health_check',
      who: ctx.caller,
      what: 'Signer not available for health check',
      why: 'Configuration error: signer is required',
      result: 'error',
    });
    return { status: 'error', reason: 'Signer is required for health_check' };
  }

  try {
    await ctx.signer.healthCheck();

    ctx.auditSink.log({
      service,
      action: 'health_check',
      who: ctx.caller,
      what: 'Health check passed',
      why: 'Health check requested',
      result: 'approved',
    });

    return { status: 'approved', data: JSON.stringify({ status: 'healthy' }) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'health_check',
      who: ctx.caller,
      what: 'Health check failed',
      why: 'Health check error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: msg };
  }
}
