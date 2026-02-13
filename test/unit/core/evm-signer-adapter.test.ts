import { describe, it, expect, vi } from 'vitest';
import type { SigningProvider, SignatureBlob, PublicKeyBlob } from '@/core/signing-provider.js';
import type { Address } from 'viem';
import type * as EvmSignerUtil from '@/evm-signer.util.js';

// ============================================================================
// Mock evm-signer.util — isolate orchestration from crypto internals
// ============================================================================

const MOCK_R = new Uint8Array(32).fill(0xaa);
const MOCK_S = new Uint8Array(32).fill(0xbb);
const MOCK_Y_PARITY = 1;

vi.mock('@/evm-signer.util.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EvmSignerUtil>();
  return {
    ...actual,
    // Keep publicToAddress real so getAddress tests work with actual crypto
    publicToAddress: actual.publicToAddress,
    // Mock DER parsing and signature processing
    parseDerSignature: vi.fn().mockReturnValue({ r: MOCK_R, s: MOCK_S }),
    normalizeSignature: vi.fn().mockReturnValue({ r: MOCK_R, s: MOCK_S }),
    resolveRecoveryParam: vi.fn().mockResolvedValue(MOCK_Y_PARITY),
  };
});

// Import after mock setup
const { EvmSignerAdapter } = await import('@/core/evm-signer-adapter.js');
const { parseDerSignature, normalizeSignature, resolveRecoveryParam } = await import(
  '@/evm-signer.util.js'
);

// ============================================================================
// Test Vectors — Hardhat Account #0
// ============================================================================

const HARDHAT_0_ADDRESS: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

/** Uncompressed secp256k1 public key (65 bytes) for Hardhat #0 */
const HARDHAT_0_PUBKEY = new Uint8Array(
  Buffer.from(
    '048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5e',
    'hex',
  ),
);

const MOCK_DER_SIGNATURE = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);

// ============================================================================
// Helpers
// ============================================================================

function createMockSigningProvider(overrides?: Partial<SigningProvider>): SigningProvider {
  const mockSignatureBlob: SignatureBlob = {
    bytes: MOCK_DER_SIGNATURE,
    encoding: 'der',
    algorithm: 'secp256k1',
  };
  const mockPublicKeyBlob: PublicKeyBlob = {
    bytes: HARDHAT_0_PUBKEY,
    algorithm: 'secp256k1',
  };
  return {
    signDigest: vi.fn().mockResolvedValue(mockSignatureBlob),
    getPublicKey: vi.fn().mockResolvedValue(mockPublicKeyBlob),
    healthCheck: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createAdapter(
  provider: SigningProvider,
  config?: { expectedAddress?: Address },
): InstanceType<typeof EvmSignerAdapter> {
  return new EvmSignerAdapter(provider, config);
}

// ============================================================================
// getAddress
// ============================================================================

describe('EvmSignerAdapter.getAddress', () => {
  it('should derive address from provider public key', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const address = await adapter.getAddress();
    expect(address.toLowerCase()).toBe(HARDHAT_0_ADDRESS.toLowerCase());
    expect(provider.getPublicKey).toHaveBeenCalledOnce();
  });

  it('should cache address using promise memoization', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const [addr1, addr2] = await Promise.all([
      adapter.getAddress(),
      adapter.getAddress(),
    ]);

    expect(addr1).toBe(addr2);
    expect(provider.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it('should reuse cached address on subsequent calls', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    await adapter.getAddress();
    await adapter.getAddress();

    expect(provider.getPublicKey).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// signTransaction
// ============================================================================

describe('EvmSignerAdapter.signTransaction', () => {
  it('should sign and return a serialized signed transaction', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const tx = {
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
      value: 1000000000000000000n,
      nonce: 0,
      gas: 21000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1000000000n,
      chainId: 1,
      type: 'eip1559' as const,
    };

    const signedTx = await adapter.signTransaction(tx);
    expect(signedTx).toBeDefined();
    expect(typeof signedTx).toBe('string');
    expect(signedTx.startsWith('0x')).toBe(true);
    expect(signedTx.startsWith('0x02')).toBe(true);
  });

  it('should call signDigest with a 32-byte digest', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const tx = {
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
      value: 0n,
      nonce: 0,
      gas: 21000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1000000000n,
      chainId: 1,
      type: 'eip1559' as const,
    };

    await adapter.signTransaction(tx);
    expect(provider.signDigest).toHaveBeenCalledWith(
      expect.any(Uint8Array),
    );

    const digest = (provider.signDigest as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(digest.length).toBe(32);
  });

  it('should invoke parseDerSignature, normalizeSignature, and resolveRecoveryParam', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const tx = {
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
      value: 0n,
      nonce: 0,
      gas: 21000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1000000000n,
      chainId: 1,
      type: 'eip1559' as const,
    };

    await adapter.signTransaction(tx);

    expect(parseDerSignature).toHaveBeenCalledWith(MOCK_DER_SIGNATURE);
    expect(normalizeSignature).toHaveBeenCalledWith(MOCK_R, MOCK_S);
    expect(resolveRecoveryParam).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      MOCK_R,
      MOCK_S,
      expect.stringMatching(/^0x[0-9a-fA-F]{40}$/),
    );
  });
});

// ============================================================================
// signTypedData
// ============================================================================

describe('EvmSignerAdapter.signTypedData', () => {
  const eip2612PermitParams = {
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit' as const,
    message: {
      owner: HARDHAT_0_ADDRESS,
      spender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: 1000000n,
      nonce: 0n,
      deadline: 1700000000n,
    },
  };

  it('should return {v, r, s} signature components', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const sig = await adapter.signTypedData(eip2612PermitParams);

    // v = yParity(1) + 27 = 28
    expect(sig.v).toBe(28);
    expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should set v = yParity + 27', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const sig = await adapter.signTypedData(eip2612PermitParams);
    // With mock yParity = 1, v should be 28
    expect(sig.v).toBe(MOCK_Y_PARITY + 27);
  });

  it('should call signDigest with hashTypedData result', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    await adapter.signTypedData(eip2612PermitParams);
    expect(provider.signDigest).toHaveBeenCalledWith(
      expect.any(Uint8Array),
    );

    const digest = (provider.signDigest as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(digest.length).toBe(32);
  });
});

// ============================================================================
// healthCheck
// ============================================================================

describe('EvmSignerAdapter.healthCheck', () => {
  it('should pass when provider is healthy and no expectedAddress', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    await expect(adapter.healthCheck()).resolves.toBeUndefined();
    expect(provider.healthCheck).toHaveBeenCalledOnce();
  });

  it('should pass with matching expectedAddress', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider, {
      expectedAddress: HARDHAT_0_ADDRESS,
    });

    await expect(adapter.healthCheck()).resolves.toBeUndefined();
    expect(provider.getPublicKey).toHaveBeenCalled();
  });

  it('should throw when derived address does not match expectedAddress', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider, {
      expectedAddress: '0x0000000000000000000000000000000000000001' as Address,
    });

    await expect(adapter.healthCheck()).rejects.toThrow(
      'does not match expected',
    );
  });

  it('should compare expectedAddress case-insensitively', async () => {
    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider, {
      expectedAddress: HARDHAT_0_ADDRESS.toLowerCase() as Address,
    });

    await expect(adapter.healthCheck()).resolves.toBeUndefined();
  });

  it('should propagate provider healthCheck failure', async () => {
    const provider = createMockSigningProvider({
      healthCheck: vi.fn().mockRejectedValue(new Error('Provider unhealthy')),
    });
    const adapter = createAdapter(provider);

    await expect(adapter.healthCheck()).rejects.toThrow('Provider unhealthy');
  });
});

// ============================================================================
// Error propagation in sign pipeline
// ============================================================================

describe('EvmSignerAdapter error propagation', () => {
  const tx = {
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
    value: 0n,
    nonce: 0,
    gas: 21000n,
    maxFeePerGas: 20000000000n,
    maxPriorityFeePerGas: 1000000000n,
    chainId: 1,
    type: 'eip1559' as const,
  };

  const typedDataParams = {
    domain: {
      name: 'Test',
      version: '1',
      chainId: 1,
      verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit' as const,
    message: {
      owner: HARDHAT_0_ADDRESS,
      spender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: 1000000n,
      nonce: 0n,
      deadline: 1700000000n,
    },
  };

  it('should propagate provider signDigest failure in signTransaction', async () => {
    const provider = createMockSigningProvider({
      signDigest: vi.fn().mockRejectedValue(new Error('Provider sign failed')),
    });
    const adapter = createAdapter(provider);

    await expect(adapter.signTransaction(tx)).rejects.toThrow('Provider sign failed');
  });

  it('should propagate provider signDigest failure in signTypedData', async () => {
    const provider = createMockSigningProvider({
      signDigest: vi.fn().mockRejectedValue(new Error('AccessDeniedException')),
    });
    const adapter = createAdapter(provider);

    await expect(adapter.signTypedData(typedDataParams)).rejects.toThrow('AccessDeniedException');
  });

  it('should propagate parseDerSignature failure', async () => {
    vi.mocked(parseDerSignature).mockImplementationOnce(() => {
      throw new Error('Invalid DER signature: missing SEQUENCE tag');
    });

    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    await expect(adapter.signTransaction(tx)).rejects.toThrow('missing SEQUENCE tag');
  });

  it('should propagate resolveRecoveryParam failure', async () => {
    vi.mocked(resolveRecoveryParam).mockRejectedValueOnce(
      new Error('no matching yParity found'),
    );

    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    await expect(adapter.signTransaction(tx)).rejects.toThrow('no matching yParity found');
  });

  it('should propagate getPublicKey failure in getAddress', async () => {
    const provider = createMockSigningProvider({
      getPublicKey: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
    });
    const adapter = createAdapter(provider);

    await expect(adapter.getAddress()).rejects.toThrow('Provider unavailable');
  });
});

// ============================================================================
// Promise memoization failure semantics
// ============================================================================

describe('EvmSignerAdapter.getAddress memoization failure', () => {
  it('should cache the rejected promise (sticky failure)', async () => {
    const mockPublicKeyBlob: PublicKeyBlob = {
      bytes: HARDHAT_0_PUBKEY,
      algorithm: 'secp256k1',
    };

    const getPublicKey = vi
      .fn()
      .mockRejectedValueOnce(new Error('first call throttled'))
      .mockResolvedValueOnce(mockPublicKeyBlob);

    const provider = createMockSigningProvider({ getPublicKey });
    const adapter = createAdapter(provider);

    // First call fails
    await expect(adapter.getAddress()).rejects.toThrow('first call throttled');
    // Second call also fails because the rejected promise is cached
    await expect(adapter.getAddress()).rejects.toThrow('first call throttled');
    // getPublicKey was only called once (promise was memoized)
    expect(getPublicKey).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// signTypedData with yParity=0
// ============================================================================

describe('EvmSignerAdapter.signTypedData yParity=0', () => {
  it('should set v = 27 when yParity is 0', async () => {
    vi.mocked(resolveRecoveryParam).mockResolvedValueOnce(0);

    const provider = createMockSigningProvider();
    const adapter = createAdapter(provider);

    const sig = await adapter.signTypedData({
      domain: {
        name: 'Test',
        version: '1',
        chainId: 1,
        verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit' as const,
      message: {
        owner: HARDHAT_0_ADDRESS,
        spender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        value: 1000000n,
        nonce: 0n,
        deadline: 1700000000n,
      },
    });

    expect(sig.v).toBe(27);
  });
});
