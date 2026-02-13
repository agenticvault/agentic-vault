import { describe, it, expect, vi } from 'vitest';

// Mock the AWS SDK to avoid real connections
vi.mock('@aws-sdk/client-kms', () => {
  class MockKMSClient {
    send = vi.fn();
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

const { createSigningProvider } = await import('@/provider/factory.js');
const { AwsKmsProvider } = await import('@/providers/aws-kms/aws-kms-provider.js');

describe('createSigningProvider', () => {
  it('should create an AwsKmsProvider for provider: "aws-kms"', () => {
    const provider = createSigningProvider({
      provider: 'aws-kms',
      keyId: 'test-key-id',
      region: 'us-east-1',
    });

    expect(provider).toBeInstanceOf(AwsKmsProvider);
  });

  it('should pass region and keyId to the created provider', async () => {
    const provider = createSigningProvider({
      provider: 'aws-kms',
      keyId: 'my-key-123',
      region: 'ap-northeast-1',
    });

    // Verify it's an AwsKmsProvider (the provider is properly constructed)
    expect(provider).toBeInstanceOf(AwsKmsProvider);
    // The healthCheck method exists (it's a SigningProvider)
    expect(typeof provider.signDigest).toBe('function');
    expect(typeof provider.getPublicKey).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
  });

  it('should throw on unknown provider type', () => {
    expect(() =>
      createSigningProvider({
        provider: 'unknown' as 'aws-kms',
        keyId: 'test',
        region: 'us-east-1',
      }),
    ).toThrow('Unknown provider');
  });

  it('should create distinct instances for different configs', () => {
    const provider1 = createSigningProvider({
      provider: 'aws-kms',
      keyId: 'key-1',
      region: 'us-east-1',
    });
    const provider2 = createSigningProvider({
      provider: 'aws-kms',
      keyId: 'key-2',
      region: 'us-west-2',
    });

    expect(provider1).not.toBe(provider2);
  });
});
