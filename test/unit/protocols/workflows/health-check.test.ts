import { describe, it, expect, vi } from 'vitest';
import { healthCheck } from '@/protocols/workflows/health-check.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

function createMockCtx(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn(),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    caller: 'mcp-client',
    ...overrides,
  };
}

describe('healthCheck workflow', () => {
  it('should return approved with healthy status JSON', async () => {
    const ctx = createMockCtx();
    const result = await healthCheck(ctx);
    expect(result.status).toBe('approved');
    if (result.status !== 'approved') throw new Error('Expected approved');
    expect(JSON.parse(result.data)).toEqual({ status: 'healthy' });
  });

  it('should return error when signer is missing', async () => {
    const ctx = createMockCtx({ signer: undefined });
    const result = await healthCheck(ctx);
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('reason', 'Signer is required for health_check');
  });

  it('should return error when health check fails', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.signer!.healthCheck).mockRejectedValue(new Error('KMS unreachable'));
    const result = await healthCheck(ctx);
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('reason', 'KMS unreachable');
  });

  it('should audit successful health check', async () => {
    const ctx = createMockCtx();
    await healthCheck(ctx);
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'health_check', result: 'approved' }),
    );
  });

  it('should audit failed health check', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.signer!.healthCheck).mockRejectedValue(new Error('fail'));
    await healthCheck(ctx);
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'health_check', result: 'error' }),
    );
  });
});
