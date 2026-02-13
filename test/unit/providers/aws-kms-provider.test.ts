import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IKmsClient } from '@/kms-client.js';
import { AwsKmsProvider } from '@/providers/aws-kms/aws-kms-provider.js';

// ============================================================================
// Test Constants
// ============================================================================

const TEST_KEY_ID = 'test-key-id-12345';

const MOCK_DER_SIGNATURE = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);

const MOCK_PUBKEY = new Uint8Array(65).fill(0x04);

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
    getPublicKey: vi.fn().mockResolvedValue(MOCK_PUBKEY),
    describeKey: vi.fn().mockResolvedValue(VALID_KEY_METADATA),
    ...overrides,
  };
}

// ============================================================================
// signDigest
// ============================================================================

describe('AwsKmsProvider.signDigest', () => {
  let mockClient: IKmsClient;
  let provider: AwsKmsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockKmsClient();
    provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });
  });

  it('should return a SignatureBlob with DER encoding and secp256k1 algorithm', async () => {
    const digest = new Uint8Array(32).fill(0xab);
    const result = await provider.signDigest(digest);

    expect(result.bytes).toEqual(MOCK_DER_SIGNATURE);
    expect(result.encoding).toBe('der');
    expect(result.algorithm).toBe('secp256k1');
  });

  it('should delegate to kmsClient.signDigest with bound keyId', async () => {
    const digest = new Uint8Array(32).fill(0xab);
    await provider.signDigest(digest);

    expect(mockClient.signDigest).toHaveBeenCalledWith(TEST_KEY_ID, digest);
  });

  it('should propagate kmsClient errors', async () => {
    const client = createMockKmsClient({
      signDigest: vi.fn().mockRejectedValue(new Error('KMS throttled')),
    });
    const p = new AwsKmsProvider(client, { keyId: TEST_KEY_ID });

    await expect(p.signDigest(new Uint8Array(32))).rejects.toThrow('KMS throttled');
  });
});

// ============================================================================
// getPublicKey
// ============================================================================

describe('AwsKmsProvider.getPublicKey', () => {
  let mockClient: IKmsClient;
  let provider: AwsKmsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockKmsClient();
    provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });
  });

  it('should return a PublicKeyBlob with secp256k1 algorithm', async () => {
    const result = await provider.getPublicKey();

    expect(result.bytes).toEqual(MOCK_PUBKEY);
    expect(result.algorithm).toBe('secp256k1');
  });

  it('should delegate to kmsClient.getPublicKey with bound keyId', async () => {
    await provider.getPublicKey();

    expect(mockClient.getPublicKey).toHaveBeenCalledWith(TEST_KEY_ID);
  });

  it('should propagate kmsClient errors', async () => {
    const client = createMockKmsClient({
      getPublicKey: vi.fn().mockRejectedValue(new Error('NotFoundException')),
    });
    const p = new AwsKmsProvider(client, { keyId: TEST_KEY_ID });

    await expect(p.getPublicKey()).rejects.toThrow('NotFoundException');
  });
});

// ============================================================================
// healthCheck
// ============================================================================

describe('AwsKmsProvider.healthCheck', () => {
  it('should pass with valid key metadata', async () => {
    const mockClient = createMockKmsClient();
    const provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });

    await expect(provider.healthCheck()).resolves.toBeUndefined();
    expect(mockClient.describeKey).toHaveBeenCalledWith(TEST_KEY_ID);
  });

  it('should throw when KeySpec is not ECC_SECG_P256K1', async () => {
    const mockClient = createMockKmsClient({
      describeKey: vi.fn().mockResolvedValue({
        ...VALID_KEY_METADATA,
        keySpec: 'RSA_2048',
      }),
    });
    const provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });

    await expect(provider.healthCheck()).rejects.toThrow(
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
    const provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });

    await expect(provider.healthCheck()).rejects.toThrow(
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
    const provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });

    await expect(provider.healthCheck()).rejects.toThrow(
      'not enabled: Disabled',
    );
  });

  it('should propagate kmsClient errors', async () => {
    const mockClient = createMockKmsClient({
      describeKey: vi.fn().mockRejectedValue(new Error('ThrottlingException')),
    });
    const provider = new AwsKmsProvider(mockClient, { keyId: TEST_KEY_ID });

    await expect(provider.healthCheck()).rejects.toThrow('ThrottlingException');
  });
});
