import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aws-sdk/client-kms
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-kms', () => {
  class MockKMSClient {
    send = mockSend;
  }
  class MockSignCommand {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  class MockGetPublicKeyCommand {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  class MockDescribeKeyCommand {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  return {
    KMSClient: MockKMSClient,
    SignCommand: MockSignCommand,
    GetPublicKeyCommand: MockGetPublicKeyCommand,
    DescribeKeyCommand: MockDescribeKeyCommand,
  };
});

// Mock parseDerPublicKey
vi.mock('@/evm-signer.util.js', () => ({
  parseDerPublicKey: vi.fn().mockReturnValue(new Uint8Array(65).fill(0x04)),
}));

const { AwsKmsClient } = await import('@/kms-client.js');
const { parseDerPublicKey } = await import('@/evm-signer.util.js');

const KEY_ID = 'test-key-id';

describe('AwsKmsClient', () => {
  let client: InstanceType<typeof AwsKmsClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AwsKmsClient({ region: 'ap-northeast-1' });
  });

  // --------------------------------------------------------------------------
  // signDigest
  // --------------------------------------------------------------------------

  describe('signDigest', () => {
    it('should call KMS Sign with correct parameters', async () => {
      const mockSignature = new Uint8Array([0x30, 0x06]);
      mockSend.mockResolvedValueOnce({ Signature: mockSignature });

      const digest = new Uint8Array(32).fill(0xab);
      const result = await client.signDigest(KEY_ID, digest);

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        KeyId: KEY_ID,
        Message: digest,
        SigningAlgorithm: 'ECDSA_SHA_256',
        MessageType: 'DIGEST',
      });
      expect(result).toEqual(new Uint8Array(mockSignature));
    });

    it('should throw when digest is not 32 bytes', async () => {
      await expect(client.signDigest(KEY_ID, new Uint8Array(31))).rejects.toThrow(
        'Digest must be 32 bytes, got 31',
      );
      await expect(client.signDigest(KEY_ID, new Uint8Array(33))).rejects.toThrow(
        'Digest must be 32 bytes, got 33',
      );
      await expect(client.signDigest(KEY_ID, new Uint8Array(0))).rejects.toThrow(
        'Digest must be 32 bytes, got 0',
      );
    });

    it('should throw when KMS response is missing Signature', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(client.signDigest(KEY_ID, new Uint8Array(32))).rejects.toThrow(
        'KMS Sign response missing Signature',
      );
    });

    it('should propagate KMS SDK errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDeniedException'));
      await expect(client.signDigest(KEY_ID, new Uint8Array(32))).rejects.toThrow(
        'AccessDeniedException',
      );
    });
  });

  // --------------------------------------------------------------------------
  // getPublicKey
  // --------------------------------------------------------------------------

  describe('getPublicKey', () => {
    it('should call KMS GetPublicKey and parse DER result', async () => {
      const mockDer = new Uint8Array([0x30, 0x56]);
      mockSend.mockResolvedValueOnce({ PublicKey: mockDer });

      await client.getPublicKey(KEY_ID);

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({ KeyId: KEY_ID });
      expect(parseDerPublicKey).toHaveBeenCalledWith(new Uint8Array(mockDer));
    });

    it('should throw when KMS response is missing PublicKey', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(client.getPublicKey(KEY_ID)).rejects.toThrow(
        'KMS GetPublicKey response missing PublicKey',
      );
    });

    it('should propagate KMS SDK errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFoundException'));
      await expect(client.getPublicKey(KEY_ID)).rejects.toThrow('NotFoundException');
    });
  });

  // --------------------------------------------------------------------------
  // describeKey
  // --------------------------------------------------------------------------

  describe('describeKey', () => {
    it('should return key metadata', async () => {
      mockSend.mockResolvedValueOnce({
        KeyMetadata: {
          KeySpec: 'ECC_SECG_P256K1',
          KeyUsage: 'SIGN_VERIFY',
          KeyState: 'Enabled',
        },
      });

      const metadata = await client.describeKey(KEY_ID);

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({ KeyId: KEY_ID });
      expect(metadata).toEqual({
        keySpec: 'ECC_SECG_P256K1',
        keyUsage: 'SIGN_VERIFY',
        keyState: 'Enabled',
      });
    });

    it('should fallback to UNKNOWN for null metadata fields', async () => {
      mockSend.mockResolvedValueOnce({
        KeyMetadata: {
          KeySpec: undefined,
          KeyUsage: undefined,
          KeyState: undefined,
        },
      });

      const metadata = await client.describeKey(KEY_ID);
      expect(metadata).toEqual({
        keySpec: 'UNKNOWN',
        keyUsage: 'UNKNOWN',
        keyState: 'UNKNOWN',
      });
    });

    it('should throw when KMS response is missing KeyMetadata', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(client.describeKey(KEY_ID)).rejects.toThrow(
        'KMS DescribeKey response missing KeyMetadata',
      );
    });

    it('should propagate KMS SDK errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('ThrottlingException'));
      await expect(client.describeKey(KEY_ID)).rejects.toThrow('ThrottlingException');
    });
  });
});
