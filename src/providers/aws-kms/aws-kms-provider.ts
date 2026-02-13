import type { SigningProvider, SignatureBlob, PublicKeyBlob } from '../../core/signing-provider.js';
import type { IKmsClient } from './aws-kms-client.js';

export interface AwsKmsProviderConfig {
  keyId: string;
}

/**
 * AWS KMS implementation of SigningProvider.
 * Key is bound at construction time (no keyId per call).
 */
export class AwsKmsProvider implements SigningProvider {
  private readonly keyId: string;
  private readonly kmsClient: IKmsClient;

  constructor(kmsClient: IKmsClient, config: AwsKmsProviderConfig) {
    this.kmsClient = kmsClient;
    this.keyId = config.keyId;
  }

  async signDigest(digest: Uint8Array): Promise<SignatureBlob> {
    const bytes = await this.kmsClient.signDigest(this.keyId, digest);
    return {
      bytes,
      encoding: 'der',
      algorithm: 'secp256k1',
    };
  }

  async getPublicKey(): Promise<PublicKeyBlob> {
    const bytes = await this.kmsClient.getPublicKey(this.keyId);
    return {
      bytes,
      algorithm: 'secp256k1',
    };
  }

  async healthCheck(): Promise<void> {
    const metadata = await this.kmsClient.describeKey(this.keyId);

    if (metadata.keySpec !== 'ECC_SECG_P256K1') {
      throw new Error(
        `KMS key has invalid KeySpec: ${metadata.keySpec}, expected ECC_SECG_P256K1`,
      );
    }
    if (metadata.keyUsage !== 'SIGN_VERIFY') {
      throw new Error(
        `KMS key has invalid KeyUsage: ${metadata.keyUsage}, expected SIGN_VERIFY`,
      );
    }
    if (metadata.keyState !== 'Enabled') {
      throw new Error(
        `KMS key is not enabled: ${metadata.keyState}`,
      );
    }
  }
}
