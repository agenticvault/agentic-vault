import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendTransfer, sendErc20Transfer } from '@/protocols/workflows/send-transfer.js';
import type { WorkflowContext, WorkflowRpcProvider } from '@/protocols/workflows/types.js';

function createMockRpcProvider(): WorkflowRpcProvider {
  return {
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getErc20Balance: vi.fn().mockResolvedValue(500000000n),
    getTransactionCount: vi.fn().mockResolvedValue(42),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 30000000000n, maxPriorityFeePerGas: 1500000000n }),
    getNativeCurrencySymbol: vi.fn().mockReturnValue('ETH'),
    sendRawTransaction: vi.fn().mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
  };
}

function createMockContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8...signedtx'),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditSink: { log: vi.fn() },
    dispatcher: {
      dispatch: vi.fn().mockReturnValue({
        protocol: 'erc20',
        action: 'transfer',
        chainId: 1,
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        selector: '0xa9059cbb',
        args: { to: '0x1234567890123456789012345678901234567890', amount: 1000000n },
      }),
    },
    rpcProvider: createMockRpcProvider(),
    caller: 'mcp-client',
    service: 'test-service',
    ...overrides,
  };
}

describe('sendTransfer workflow', () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should send native transfer and return txHash', async () => {
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000000000000000000',
    });

    expect(result.status).toBe('approved');
    if (result.status === 'approved') {
      const data = JSON.parse(result.data);
      expect(data.txHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(data.explorerUrl).toBe('https://etherscan.io/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    }
  });

  it('should call policy evaluate with correct params', async () => {
    await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000000000000000000',
    });

    expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith({
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      amountWei: 1000000000000000000n,
    });
  });

  it('should use estimateFeesPerGas for EIP-1559 fees (not getGasPrice)', async () => {
    await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(ctx.rpcProvider!.estimateFeesPerGas).toHaveBeenCalledWith(1);
    expect(ctx.rpcProvider!.getGasPrice).not.toHaveBeenCalled();
    expect(ctx.signer!.signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 1500000000n,
        type: 'eip1559',
      }),
    );
  });

  it('should return denied when policy rejects', async () => {
    ctx = createMockContext({
      policyEngine: {
        evaluate: vi.fn().mockReturnValue({
          allowed: false,
          violations: ['amount exceeds limit'],
        }),
      },
    });

    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '999999999999999999999',
    });

    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toContain('amount exceeds limit');
    }
    expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
  });

  it('should return error when rpcProvider is missing', async () => {
    ctx = createMockContext({ rpcProvider: undefined });
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('RPC provider is required');
    }
  });

  it('should return error when signer is missing and not dryRun', async () => {
    ctx = createMockContext({ signer: undefined });
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Signer is required');
    }
  });

  it('should return dry-run-approved without signer when dryRun is true', async () => {
    ctx = createMockContext({ signer: undefined, dryRun: true });
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('dry-run-approved');
  });

  it('should return dry-run-approved without rpcProvider when dryRun is true', async () => {
    ctx = createMockContext({ rpcProvider: undefined, signer: undefined, dryRun: true });
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('dry-run-approved');
  });

  it('should return dry-run-approved without signing or broadcasting', async () => {
    ctx = createMockContext({ dryRun: true });
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('dry-run-approved');
    expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
    expect(ctx.rpcProvider!.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('should return error for invalid value string', async () => {
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: 'not-a-number',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Invalid value');
    }
  });

  it('should return error when signing fails', async () => {
    ctx = createMockContext({
      signer: {
        getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        signTransaction: vi.fn().mockRejectedValue(new Error('KMS throttled')),
        signTypedData: vi.fn(),
        healthCheck: vi.fn(),
      },
    });

    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('KMS throttled');
    }
  });

  it('should return error when broadcast fails', async () => {
    const rpcProvider = createMockRpcProvider();
    rpcProvider.sendRawTransaction = vi.fn().mockRejectedValue(new Error('nonce too low'));
    ctx = createMockContext({ rpcProvider });

    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('nonce too low');
    }
  });

  it('should reject negative value', async () => {
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '-1000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('non-negative');
    }
    expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
  });

  it('should handle zero-value transfer', async () => {
    const result = await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '0',
    });

    expect(result.status).toBe('approved');
    expect(ctx.signer!.signTransaction).toHaveBeenCalled();
  });

  it('should audit log approved transfer', async () => {
    await sendTransfer(ctx, {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'send_transfer',
        result: 'approved',
      }),
    );
  });

  it('should construct explorer URL for Sepolia', async () => {
    const result = await sendTransfer(ctx, {
      chainId: 11155111,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.status).toBe('approved');
    if (result.status === 'approved') {
      const data = JSON.parse(result.data);
      expect(data.explorerUrl).toContain('sepolia.etherscan.io');
    }
  });
});

describe('sendErc20Transfer workflow', () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should send ERC20 transfer and return txHash', async () => {
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('approved');
    if (result.status === 'approved') {
      const data = JSON.parse(result.data);
      expect(data.txHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    }
    expect(ctx.signer!.signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        data: expect.stringMatching(/^0x/),
      }),
    );
  });

  it('should decode calldata via dispatcher', async () => {
    await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(ctx.dispatcher!.dispatch).toHaveBeenCalledWith(
      1,
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      expect.stringMatching(/^0xa9059cbb/), // transfer selector
    );
  });

  it('should pass intent to policy evaluation', async () => {
    await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 1,
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        selector: '0xa9059cbb',
        amountWei: 1000000n,
        intent: expect.objectContaining({ protocol: 'erc20', action: 'transfer' }),
      }),
    );
  });

  it('should use estimateFeesPerGas for ERC20 transfer fees', async () => {
    await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(ctx.rpcProvider!.estimateFeesPerGas).toHaveBeenCalledWith(1);
    expect(ctx.rpcProvider!.getGasPrice).not.toHaveBeenCalled();
    expect(ctx.signer!.signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 1500000000n,
        type: 'eip1559',
      }),
    );
  });

  it('should return denied when policy rejects', async () => {
    ctx = createMockContext({
      policyEngine: {
        evaluate: vi.fn().mockReturnValue({
          allowed: false,
          violations: ['token not in allowed list'],
        }),
      },
    });

    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toContain('token not in allowed list');
    }
    expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
  });

  it('should reject when dispatcher returns unknown protocol', async () => {
    ctx = createMockContext({
      dispatcher: {
        dispatch: vi.fn().mockReturnValue({
          protocol: 'unknown',
          chainId: 1,
          to: '0xdeadbeef',
          reason: 'No registered decoder',
        }),
      },
    });

    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toContain('Rejected');
    }
  });

  it('should return error when rpcProvider is missing', async () => {
    ctx = createMockContext({ rpcProvider: undefined });
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('RPC provider is required');
    }
  });

  it('should return error when signer is missing and not dryRun', async () => {
    ctx = createMockContext({ signer: undefined });
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Signer is required');
    }
  });

  it('should return dry-run-approved without signer when dryRun is true', async () => {
    ctx = createMockContext({ signer: undefined, dryRun: true });
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('dry-run-approved');
  });

  it('should return dry-run-approved without rpcProvider when dryRun is true', async () => {
    ctx = createMockContext({ rpcProvider: undefined, signer: undefined, dryRun: true });
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('dry-run-approved');
  });

  it('should return dry-run-approved without signing or broadcasting', async () => {
    ctx = createMockContext({ dryRun: true });
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('dry-run-approved');
    expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
    expect(ctx.rpcProvider!.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('should return error when dispatcher is missing', async () => {
    ctx = createMockContext({ dispatcher: undefined });
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Dispatcher is required');
    }
  });

  it('should return error for invalid amount string', async () => {
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: 'invalid',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('Invalid amount');
    }
  });

  it('should return error when broadcast fails', async () => {
    const rpcProvider = createMockRpcProvider();
    rpcProvider.sendRawTransaction = vi.fn().mockRejectedValue(new Error('insufficient funds'));
    ctx = createMockContext({ rpcProvider });

    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('insufficient funds');
    }
  });

  it('should reject negative amount', async () => {
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '-500',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('non-negative');
    }
    expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
  });

  it('should handle zero-amount ERC20 transfer', async () => {
    const result = await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '0',
    });

    expect(result.status).toBe('approved');
    expect(ctx.signer!.signTransaction).toHaveBeenCalled();
  });

  it('should audit log approved ERC20 transfer', async () => {
    await sendErc20Transfer(ctx, {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(ctx.auditSink.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'send_erc20_transfer',
        result: 'approved',
      }),
    );
  });
});
