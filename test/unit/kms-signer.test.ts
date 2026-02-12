import { describe, it, expect, vi } from 'vitest';
import type { IKmsClient } from '@/kms-client.js';
import type { Address } from 'viem';

// ============================================================================
// Mock evm-signer.util — isolate orchestration from crypto internals
// ============================================================================

const MOCK_R = new Uint8Array(32).fill(0xaa);
const MOCK_S = new Uint8Array(32).fill(0xbb);
const MOCK_Y_PARITY = 1;

vi.mock('@/evm-signer.util.js', async (importOriginal) => {
  const actual = await importOriginal();
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
const { KmsSignerAdapter } = await import('@/kms-signer.js');
const { parseDerSignature, normalizeSignature, resolveRecoveryParam } = await import(
  '@/evm-signer.util.js'
);

// ============================================================================
// Test Vectors — Hardhat Account #0
// ============================================================================

const HARDHAT_0_ADDRESS: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const TEST_KEY_ID = 'test-key-id-12345';

/** Uncompressed secp256k1 public key (65 bytes) for Hardhat #0 */
const HARDHAT_0_PUBKEY = new Uint8Array(
  Buffer.from(
    '048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5e',
    'hex',
  ),
);

const MOCK_DER_SIGNATURE = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);

const VALID_KEY_METADATA = {
  keySpec: 'ECC_SECG_P256K1',
  keyUsage: 'SIGN_VERIFY',
  keyState: 'Enabled',
};

// ============================================================================
// Helpers
// ============================================================================

function createMockKmsClient(overrides?: Partial<IKmsClient>): IKmsClient {
  return {
    signDigest: vi.fn().mockResolvedValue(MOCK_DER_SIGNATURE),
    getPublicKey: vi.fn().mockResolvedValue(HARDHAT_0_PUBKEY),
    describeKey: vi.fn().mockResolvedValue(VALID_KEY_METADATA),
    ...overrides,
  };
}

function createSigner(
  mockClient: IKmsClient,
  config?: { expectedAddress?: Address },
): InstanceType<typeof KmsSignerAdapter> {
  return new KmsSignerAdapter(mockClient, {
    keyId: TEST_KEY_ID,
    region: 'ap-northeast-1',
    ...config,
  });
}

// ============================================================================
// getAddress
// ============================================================================

describe('KmsSignerAdapter.getAddress', () => {
  it('should derive address from KMS public key', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    const address = await signer.getAddress();
    expect(address.toLowerCase()).toBe(HARDHAT_0_ADDRESS.toLowerCase());
    expect(mockClient.getPublicKey).toHaveBeenCalledWith(TEST_KEY_ID);
  });

  it('should cache address using promise memoization', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    const [addr1, addr2] = await Promise.all([
      signer.getAddress(),
      signer.getAddress(),
    ]);

    expect(addr1).toBe(addr2);
    expect(mockClient.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it('should reuse cached address on subsequent calls', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    await signer.getAddress();
    await signer.getAddress();

    expect(mockClient.getPublicKey).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// signTransaction
// ============================================================================

describe('KmsSignerAdapter.signTransaction', () => {
  it('should sign and return a serialized signed transaction', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

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

    const signedTx = await signer.signTransaction(tx);
    expect(signedTx).toBeDefined();
    expect(typeof signedTx).toBe('string');
    expect(signedTx.startsWith('0x')).toBe(true);
    expect(signedTx.startsWith('0x02')).toBe(true);
  });

  it('should call signDigest with a 32-byte keccak256 digest', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

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

    await signer.signTransaction(tx);
    expect(mockClient.signDigest).toHaveBeenCalledWith(
      TEST_KEY_ID,
      expect.any(Uint8Array),
    );

    const digest = (mockClient.signDigest as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(digest.length).toBe(32);
  });

  it('should invoke parseDerSignature, normalizeSignature, and resolveRecoveryParam', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

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

    await signer.signTransaction(tx);

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

describe('KmsSignerAdapter.signTypedData', () => {
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
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    const sig = await signer.signTypedData(eip2612PermitParams);

    // v = yParity(1) + 27 = 28
    expect(sig.v).toBe(28);
    expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should set v = yParity + 27', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    const sig = await signer.signTypedData(eip2612PermitParams);
    // With mock yParity = 1, v should be 28
    expect(sig.v).toBe(MOCK_Y_PARITY + 27);
  });

  it('should call signDigest with hashTypedData result', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    await signer.signTypedData(eip2612PermitParams);
    expect(mockClient.signDigest).toHaveBeenCalledWith(
      TEST_KEY_ID,
      expect.any(Uint8Array),
    );

    const digest = (mockClient.signDigest as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(digest.length).toBe(32);
  });
});

// ============================================================================
// healthCheck
// ============================================================================

describe('KmsSignerAdapter.healthCheck', () => {
  it('should pass with valid key metadata and no expectedAddress', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    await expect(signer.healthCheck()).resolves.toBeUndefined();
    expect(mockClient.describeKey).toHaveBeenCalledWith(TEST_KEY_ID);
  });

  it('should pass with valid metadata and matching expectedAddress', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient, {
      expectedAddress: HARDHAT_0_ADDRESS,
    });

    await expect(signer.healthCheck()).resolves.toBeUndefined();
    expect(mockClient.getPublicKey).toHaveBeenCalledWith(TEST_KEY_ID);
  });

  it('should throw when KeySpec is not ECC_SECG_P256K1', async () => {
    const mockClient = createMockKmsClient({
      describeKey: vi.fn().mockResolvedValue({
        ...VALID_KEY_METADATA,
        keySpec: 'RSA_2048',
      }),
    });
    const signer = createSigner(mockClient);

    await expect(signer.healthCheck()).rejects.toThrow(
      'invalid KeySpec: RSA_2048',
    );
  });

  it('should throw when KeyUsage is not SIGN_VERIFY', async () => {
    const mockClient = createMockKmsClient({
      describeKey: vi.fn().mockResolvedValue({
        ...VALID_KEY_METADATA,
        keyUsage: 'ENCRYPT_DECRYPT',
      }),
    });
    const signer = createSigner(mockClient);

    await expect(signer.healthCheck()).rejects.toThrow(
      'invalid KeyUsage: ENCRYPT_DECRYPT',
    );
  });

  it('should throw when key is not Enabled', async () => {
    const mockClient = createMockKmsClient({
      describeKey: vi.fn().mockResolvedValue({
        ...VALID_KEY_METADATA,
        keyState: 'Disabled',
      }),
    });
    const signer = createSigner(mockClient);

    await expect(signer.healthCheck()).rejects.toThrow('not enabled: Disabled');
  });

  it('should throw when derived address does not match expectedAddress', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient, {
      expectedAddress: '0x0000000000000000000000000000000000000001' as Address,
    });

    await expect(signer.healthCheck()).rejects.toThrow(
      'does not match expected',
    );
  });

  it('should compare expectedAddress case-insensitively', async () => {
    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient, {
      expectedAddress: HARDHAT_0_ADDRESS.toLowerCase() as Address,
    });

    await expect(signer.healthCheck()).resolves.toBeUndefined();
  });
});

// ============================================================================
// Error propagation in sign pipeline
// ============================================================================

describe('KmsSignerAdapter error propagation', () => {
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

  it('should propagate KMS signDigest failure in signTransaction', async () => {
    const mockClient = createMockKmsClient({
      signDigest: vi.fn().mockRejectedValue(new Error('KMS throttled')),
    });
    const signer = createSigner(mockClient);

    await expect(signer.signTransaction(tx)).rejects.toThrow('KMS throttled');
  });

  it('should propagate KMS signDigest failure in signTypedData', async () => {
    const mockClient = createMockKmsClient({
      signDigest: vi.fn().mockRejectedValue(new Error('AccessDeniedException')),
    });
    const signer = createSigner(mockClient);

    await expect(signer.signTypedData(typedDataParams)).rejects.toThrow('AccessDeniedException');
  });

  it('should propagate parseDerSignature failure', async () => {
    vi.mocked(parseDerSignature).mockImplementationOnce(() => {
      throw new Error('Invalid DER signature: missing SEQUENCE tag');
    });

    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    await expect(signer.signTransaction(tx)).rejects.toThrow('missing SEQUENCE tag');
  });

  it('should propagate resolveRecoveryParam failure', async () => {
    vi.mocked(resolveRecoveryParam).mockRejectedValueOnce(
      new Error('no matching yParity found'),
    );

    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    await expect(signer.signTransaction(tx)).rejects.toThrow('no matching yParity found');
  });

  it('should propagate getPublicKey failure in getAddress', async () => {
    const mockClient = createMockKmsClient({
      getPublicKey: vi.fn().mockRejectedValue(new Error('KMS unavailable')),
    });
    const signer = createSigner(mockClient);

    await expect(signer.getAddress()).rejects.toThrow('KMS unavailable');
  });
});

// ============================================================================
// Promise memoization failure semantics
// ============================================================================

describe('KmsSignerAdapter.getAddress memoization failure', () => {
  it('should cache the rejected promise (sticky failure)', async () => {
    const getPublicKey = vi
      .fn()
      .mockRejectedValueOnce(new Error('first call throttled'))
      .mockResolvedValueOnce(HARDHAT_0_PUBKEY);

    const mockClient = createMockKmsClient({ getPublicKey });
    const signer = createSigner(mockClient);

    // First call fails
    await expect(signer.getAddress()).rejects.toThrow('first call throttled');
    // Second call also fails because the rejected promise is cached
    await expect(signer.getAddress()).rejects.toThrow('first call throttled');
    // getPublicKey was only called once (promise was memoized)
    expect(getPublicKey).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// signTypedData with yParity=0
// ============================================================================

describe('KmsSignerAdapter.signTypedData yParity=0', () => {
  it('should set v = 27 when yParity is 0', async () => {
    vi.mocked(resolveRecoveryParam).mockResolvedValueOnce(0);

    const mockClient = createMockKmsClient();
    const signer = createSigner(mockClient);

    const sig = await signer.signTypedData({
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
