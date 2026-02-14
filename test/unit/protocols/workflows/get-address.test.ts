import { describe, it, expect, vi } from 'vitest';
import { getAddress } from '@/protocols/workflows/get-address.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

function createMockCtx(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    caller: 'mcp-client',
    ...overrides,
  };
}

describe('getAddress workflow', () => {
  it('should return approved with address', async () => {
    const ctx = createMockCtx();
    const result = await getAddress(ctx);
    expect(result.status).toBe('approved');
    expect(result).toHaveProperty('data', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });

  it('should return error when signer is missing', async () => {
    const ctx = createMockCtx({ signer: undefined });
    const result = await getAddress(ctx);
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('reason', 'Signer is required for get_address');
  });

  it('should return error when signer throws', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.signer!.getAddress).mockRejectedValue(new Error('Connection failed'));
    const result = await getAddress(ctx);
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('reason', 'Connection failed');
  });

  it('should audit successful address lookup', async () => {
    const ctx = createMockCtx();
    await getAddress(ctx);
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'get_address', result: 'approved', who: 'mcp-client' }),
    );
  });

  it('should use custom service name', async () => {
    const ctx = createMockCtx({ service: 'agentic-vault-cli' });
    await getAddress(ctx);
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'agentic-vault-cli' }),
    );
  });
});
