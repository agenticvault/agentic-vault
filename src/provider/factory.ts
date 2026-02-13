import type { SigningProvider } from '../core/signing-provider.js';
import { AwsKmsClient } from '../providers/aws-kms/aws-kms-client.js';
import { AwsKmsProvider } from '../providers/aws-kms/aws-kms-provider.js';

export interface AwsKmsSigningProviderConfig {
  provider: 'aws-kms';
  keyId: string;
  region: string;
}

export type SigningProviderConfig = AwsKmsSigningProviderConfig;

/**
 * Factory function to create a SigningProvider from config.
 * Currently supports 'aws-kms'. Extensible for future providers.
 */
export function createSigningProvider(config: SigningProviderConfig): SigningProvider {
  switch (config.provider) {
    case 'aws-kms': {
      const kmsClient = new AwsKmsClient({ region: config.region });
      return new AwsKmsProvider(kmsClient, { keyId: config.keyId });
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive as string}`);
    }
  }
}
