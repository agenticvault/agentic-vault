import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock viem before importing the module under test
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

import { createPublicClient } from 'viem';
import { ViemRpcProvider } from '@/rpc/viem-rpc-provider.js';

function createMockClient(chainId = 1) {
  return {
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    call: vi.fn().mockResolvedValue({
      data: '0x0000000000000000000000000000000000000000000000000000000005f5e100',
    }),
    getTransactionCount: vi.fn().mockResolvedValue(42),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 30000000000n, maxPriorityFeePerGas: 1500000000n }),
    sendRawTransaction: vi.fn().mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
    getChainId: vi.fn().mockResolvedValue(chainId),
  };
}

describe('ViemRpcProvider', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createPublicClient).mockReturnValue(mockClient as never);
  });

  it('should create a client lazily on first call', async () => {
    const provider = new ViemRpcProvider();
    await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

    expect(createPublicClient).toHaveBeenCalledTimes(1);
  });

  it('should reuse client for same chainId', async () => {
    const provider = new ViemRpcProvider();
    await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

    expect(createPublicClient).toHaveBeenCalledTimes(1);
  });

  it('should create separate clients for different chainIds', async () => {
    const provider = new ViemRpcProvider();
    await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await provider.getBalance(137, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

    expect(createPublicClient).toHaveBeenCalledTimes(2);
  });

  it('should throw for unknown chainId without rpcUrl', async () => {
    const provider = new ViemRpcProvider();
    await expect(
      provider.getBalance(99999, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
    ).rejects.toThrow('Unsupported chainId 99999');
  });

  it('should accept unknown chainId when rpcUrl is provided and chainId matches', async () => {
    mockClient.getChainId.mockResolvedValue(99999);
    const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });
    await provider.getBalance(99999, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

    expect(createPublicClient).toHaveBeenCalledTimes(1);
  });

  it('should use custom rpcUrl when provided', async () => {
    const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });
    await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

    expect(createPublicClient).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.anything(),
      }),
    );
  });

  describe('getBalance', () => {
    it('should return native balance', async () => {
      const provider = new ViemRpcProvider();
      const balance = await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

      expect(balance).toBe(1000000000000000000n);
      expect(mockClient.getBalance).toHaveBeenCalledWith({
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      });
    });
  });

  describe('getErc20Balance', () => {
    it('should call token contract and return balance', async () => {
      const provider = new ViemRpcProvider();
      const balance = await provider.getErc20Balance(
        1,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      );

      expect(balance).toBe(100000000n); // 0x05f5e100
      expect(mockClient.call).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        }),
      );
    });

    it('should throw when call returns no data', async () => {
      mockClient.call.mockResolvedValue({ data: undefined });
      const provider = new ViemRpcProvider();

      await expect(
        provider.getErc20Balance(
          1,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        ),
      ).rejects.toThrow('ERC20 balanceOf call returned no data');
    });
  });

  describe('getTransactionCount', () => {
    it('should return nonce', async () => {
      const provider = new ViemRpcProvider();
      const nonce = await provider.getTransactionCount(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

      expect(nonce).toBe(42);
    });
  });

  describe('estimateGas', () => {
    it('should return gas estimate', async () => {
      const provider = new ViemRpcProvider();
      const gas = await provider.estimateGas(1, {
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        to: '0x1234567890123456789012345678901234567890',
        value: 1000n,
      });

      expect(gas).toBe(21000n);
    });
  });

  describe('getGasPrice', () => {
    it('should return gas price', async () => {
      const provider = new ViemRpcProvider();
      const price = await provider.getGasPrice(1);

      expect(price).toBe(20000000000n);
    });
  });

  describe('estimateFeesPerGas', () => {
    it('should return EIP-1559 fee estimates', async () => {
      const provider = new ViemRpcProvider();
      const fees = await provider.estimateFeesPerGas(1);

      expect(fees.maxFeePerGas).toBe(30000000000n);
      expect(fees.maxPriorityFeePerGas).toBe(1500000000n);
      expect(mockClient.estimateFeesPerGas).toHaveBeenCalled();
    });

    it('should NOT call getGasPrice when both fee fields are present', async () => {
      const provider = new ViemRpcProvider();
      await provider.estimateFeesPerGas(1);

      expect(mockClient.getGasPrice).not.toHaveBeenCalled();
    });

    it('should fall back to getGasPrice when estimateFeesPerGas returns nulls', async () => {
      mockClient.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      });
      const provider = new ViemRpcProvider();
      const fees = await provider.estimateFeesPerGas(1);

      // Fallback: gasPrice (20 gwei) * 2 for maxFeePerGas, 1.5 gwei for priority
      expect(fees.maxFeePerGas).toBe(40000000000n);
      expect(fees.maxPriorityFeePerGas).toBe(1500000000n);
    });

    it('should clamp maxPriorityFeePerGas to maxFeePerGas when priority exceeds max', async () => {
      mockClient.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: 1000000000n, // 1 gwei
        maxPriorityFeePerGas: undefined, // fallback 1.5 gwei > 1 gwei
      });
      const provider = new ViemRpcProvider();
      const fees = await provider.estimateFeesPerGas(1);

      expect(fees.maxPriorityFeePerGas).toBeLessThanOrEqual(fees.maxFeePerGas);
      expect(fees.maxPriorityFeePerGas).toBe(1000000000n);
    });

    it('should handle only maxFeePerGas present (partial data)', async () => {
      mockClient.estimateFeesPerGas.mockResolvedValue({
        maxFeePerGas: 50000000000n,
        maxPriorityFeePerGas: undefined,
      });
      const provider = new ViemRpcProvider();
      const fees = await provider.estimateFeesPerGas(1);

      expect(fees.maxFeePerGas).toBe(50000000000n);
      expect(fees.maxPriorityFeePerGas).toBe(1500000000n);
    });

    it('should fall back to getGasPrice when estimateFeesPerGas throws', async () => {
      mockClient.estimateFeesPerGas.mockRejectedValue(new Error('method not supported'));
      const provider = new ViemRpcProvider();
      const fees = await provider.estimateFeesPerGas(1);

      // Fallback: gasPrice (20 gwei) * 2, priority capped at 1.5 gwei
      expect(fees.maxFeePerGas).toBe(40000000000n);
      expect(fees.maxPriorityFeePerGas).toBe(1500000000n);
    });

    it('should cap priority to gasPrice when gasPrice is very low (fallback path)', async () => {
      mockClient.estimateFeesPerGas.mockRejectedValue(new Error('not supported'));
      mockClient.getGasPrice.mockResolvedValue(500000000n); // 0.5 gwei < 1.5 gwei default
      const provider = new ViemRpcProvider();
      const fees = await provider.estimateFeesPerGas(1);

      expect(fees.maxFeePerGas).toBe(1000000000n); // 0.5 gwei * 2
      expect(fees.maxPriorityFeePerGas).toBe(500000000n); // capped to gasPrice
    });
  });

  describe('getNativeCurrencySymbol', () => {
    it('should return ETH for Ethereum mainnet', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(1)).toBe('ETH');
    });

    it('should return POL for Polygon', () => {
      const provider = new ViemRpcProvider();
      const symbol = provider.getNativeCurrencySymbol(137);
      // viem may return 'POL' or 'MATIC' depending on version
      expect(['POL', 'MATIC']).toContain(symbol);
    });

    it('should return BNB for BSC (chainId 56)', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(56)).toBe('BNB');
    });

    it('should return AVAX for Avalanche (chainId 43114)', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(43114)).toBe('AVAX');
    });

    it('should return ETH for Optimism (chainId 10)', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(10)).toBe('ETH');
    });

    it('should return XDAI for Gnosis (chainId 100)', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(100)).toBe('XDAI');
    });

    it('should return FTM for Fantom (chainId 250)', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(250)).toBe('FTM');
    });

    it('should return NATIVE for unknown chains without override', () => {
      const provider = new ViemRpcProvider();
      expect(provider.getNativeCurrencySymbol(99999)).toBe('NATIVE');
    });

    it('should use nativeCurrencyOverrides for custom chains', () => {
      const provider = new ViemRpcProvider({
        rpcUrl: 'http://localhost:8545',
        nativeCurrencyOverrides: { 99999: 'CUSTOM' },
      });
      expect(provider.getNativeCurrencySymbol(99999)).toBe('CUSTOM');
    });

    it('should prefer override over CHAIN_MAP', () => {
      const provider = new ViemRpcProvider({
        nativeCurrencyOverrides: { 1: 'WETH' },
      });
      expect(provider.getNativeCurrencySymbol(1)).toBe('WETH');
    });
  });

  describe('sendRawTransaction', () => {
    it('should return tx hash', async () => {
      const provider = new ViemRpcProvider();
      const hash = await provider.sendRawTransaction(1, '0x02f8...');

      expect(hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(mockClient.sendRawTransaction).toHaveBeenCalledWith({
        serializedTransaction: '0x02f8...',
      });
    });
  });

  describe('chain ID validation', () => {
    it('should validate chainId when rpcUrl is provided', async () => {
      const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });
      await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

      expect(mockClient.getChainId).toHaveBeenCalledTimes(1);
    });

    it('should throw on chain ID mismatch', async () => {
      mockClient.getChainId.mockResolvedValue(11155111); // Sepolia
      const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });

      await expect(
        provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      ).rejects.toThrow('Chain ID mismatch: requested 1 but RPC endpoint returned 11155111');
    });

    it('should skip validation when no rpcUrl (default public RPC)', async () => {
      const provider = new ViemRpcProvider();
      await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

      expect(mockClient.getChainId).not.toHaveBeenCalled();
    });

    it('should not re-validate on subsequent calls (cached client)', async () => {
      const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });
      await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

      expect(mockClient.getChainId).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent initialization for same chainId', async () => {
      const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });
      await Promise.all([
        provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      ]);

      expect(createPublicClient).toHaveBeenCalledTimes(1);
      expect(mockClient.getChainId).toHaveBeenCalledTimes(1);
    });

    it('should not cache client after chain ID mismatch', async () => {
      mockClient.getChainId.mockResolvedValue(11155111);
      const provider = new ViemRpcProvider({ rpcUrl: 'http://localhost:8545' });

      await expect(
        provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      ).rejects.toThrow('Chain ID mismatch');

      // After failure, a retry should attempt initialization again (not return stale)
      mockClient.getChainId.mockResolvedValue(1);
      vi.mocked(createPublicClient).mockReturnValue(createMockClient() as never);
      await provider.getBalance(1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

      expect(createPublicClient).toHaveBeenCalledTimes(2);
    });
  });
});
