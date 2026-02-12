import {
  DescribeKeyCommand,
  GetPublicKeyCommand,
  KMSClient,
  type KMSClientConfig,
  SignCommand,
} from '@aws-sdk/client-kms';
import { parseDerPublicKey } from './evm-signer.util.js';

export interface KmsKeyMetadata {
  keySpec: string;
  keyUsage: string;
  keyState: string;
}

export interface IKmsClient {
  signDigest(keyId: string, digest: Uint8Array): Promise<Uint8Array>;
  getPublicKey(keyId: string): Promise<Uint8Array>;
  describeKey(keyId: string): Promise<KmsKeyMetadata>;
}

export class AwsKmsClient implements IKmsClient {
  private client: KMSClient;

  constructor(config: { region: string }) {
    const clientConfig: KMSClientConfig = { region: config.region };
    this.client = new KMSClient(clientConfig);
  }

  async signDigest(keyId: string, digest: Uint8Array): Promise<Uint8Array> {
    if (digest.length !== 32) {
      throw new Error(`Digest must be 32 bytes, got ${digest.length}`);
    }

    const command = new SignCommand({
      KeyId: keyId,
      Message: digest,
      SigningAlgorithm: 'ECDSA_SHA_256',
      MessageType: 'DIGEST',
    });

    const response = await this.client.send(command);

    if (!response.Signature) {
      throw new Error('KMS Sign response missing Signature');
    }

    return new Uint8Array(response.Signature);
  }

  async getPublicKey(keyId: string): Promise<Uint8Array> {
    const command = new GetPublicKeyCommand({ KeyId: keyId });
    const response = await this.client.send(command);

    if (!response.PublicKey) {
      throw new Error('KMS GetPublicKey response missing PublicKey');
    }

    const derBytes = new Uint8Array(response.PublicKey);
    return parseDerPublicKey(derBytes);
  }

  async describeKey(keyId: string): Promise<KmsKeyMetadata> {
    const command = new DescribeKeyCommand({ KeyId: keyId });
    const response = await this.client.send(command);

    if (!response.KeyMetadata) {
      throw new Error('KMS DescribeKey response missing KeyMetadata');
    }

    return {
      keySpec: response.KeyMetadata.KeySpec ?? 'UNKNOWN',
      keyUsage: response.KeyMetadata.KeyUsage ?? 'UNKNOWN',
      keyState: response.KeyMetadata.KeyState ?? 'UNKNOWN',
    };
  }
}
