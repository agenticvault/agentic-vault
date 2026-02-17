import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBalance } from '@/protocols/workflows/get-balance.js';
import type { WorkflowContext, WorkflowRpcProvider } from '@/protocols/workflows/types.js';

function createMockRpcProvider(): WorkflowRpcProvider {
  return {
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getErc20Balance: vi.fn().mockResolvedValue(500000000n),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n),
    sendRawTransaction: vi.fn().mockResolvedValue('0x'),
  };
}

function createMockContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditSink: { log: vi.fn() },
    rpcProvider: createMockRpcProvider(),
    caller: 'mcp-client',
    service: 'test-service',
    ...overrides,
  };
}

describe('getBalance workflow', () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should return native ETH balance', async () => {
    const result = await getBalance(ctx, { chainId: 1 });

    expect(result.status).toBe('approved');
    if (result.status === 'approved') {
      const data = JSON.parse(result.data);
      expect(data.balance).toBe('1000000000000000000');
      expect(data.symbol).toBe('ETH');
    }
    expect(ctx.rpcProvider!.getBalance).toHaveBeenCalledWith(
      1,
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    );
  });

  it('should return ERC20 balance when token is provided', async () => {
    const result = await getBalance(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });

    expect(result.status).toBe('approved');
    if (result.status === 'approved') {
      const data = JSON.parse(result.data);
      expect(data.balance).toBe('500000000');
      expect(data.symbol).toBe('ERC20');
    }
    expect(ctx.rpcProvider!.getErc20Balance).toHaveBeenCalledWith(
      1,
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    );
  });

  it('should use provided address instead of signer', async () => {
    const result = await getBalance(ctx, {
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890',
    });

    expect(result.status).toBe('approved');
    expect(ctx.rpcProvider!.getBalance).toHaveBeenCalledWith(
      1,
      '0x1234567890123456789012345678901234567890',
    );
    expect(ctx.signer!.getAddress).not.toHaveBeenCalled();
  });

  it('should return error when rpcProvider is missing', async () => {
    ctx = createMockContext({ rpcProvider: undefined });
    const result = await getBalance(ctx, { chainId: 1 });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('RPC provider is required');
    }
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'error' }),
    );
  });

  it('should return error when neither address nor signer available', async () => {
    ctx = createMockContext({ signer: undefined });
    const result = await getBalance(ctx, { chainId: 1 });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Address or signer is required');
    }
  });

  it('should return error when RPC call fails', async () => {
    vi.mocked(ctx.rpcProvider!.getBalance).mockRejectedValue(new Error('RPC timeout'));
    const result = await getBalance(ctx, { chainId: 1 });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('RPC timeout');
    }
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'error' }),
    );
  });

  it('should audit log the balance query', async () => {
    await getBalance(ctx, { chainId: 1 });

    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'get_balance',
        result: 'approved',
      }),
    );
  });

  it('should return error when signer.getAddress() rejects', async () => {
    ctx = createMockContext({
      signer: {
        getAddress: vi.fn().mockRejectedValue(new Error('KMS key not found')),
        signTransaction: vi.fn(),
        signTypedData: vi.fn(),
        healthCheck: vi.fn(),
      },
    });
    const result = await getBalance(ctx, { chainId: 1 });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Failed to resolve signer address');
      expect(result.reason).toContain('KMS key not found');
    }
    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'error' }),
    );
  });
});
