import {
  type Address,
  type Hex,
  type TransactionSerializable,
  hashTypedData,
  keccak256,
  serializeTransaction,
  toHex,
} from 'viem';
import type { IKmsClient } from './kms-client.js';
import type { SignTypedDataParams, SignatureComponents, SignerAdapter } from './types.js';
import {
  normalizeSignature,
  parseDerSignature,
  publicToAddress,
  resolveRecoveryParam,
} from './evm-signer.util.js';

export interface KmsSignerConfig {
  keyId: string;
  region: string;
  expectedAddress?: Address;
}

export class KmsSignerAdapter implements SignerAdapter {
  private readonly keyId: string;
  private readonly expectedAddress?: Address;
  private readonly kmsClient: IKmsClient;
  private addressPromise: Promise<Address> | null = null;

  constructor(kmsClient: IKmsClient, config: KmsSignerConfig) {
    this.kmsClient = kmsClient;
    this.keyId = config.keyId;
    this.expectedAddress = config.expectedAddress;
  }

  /**
   * Get the Ethereum address derived from the KMS public key.
   * Uses promise memoization to avoid concurrent GetPublicKey calls during cold start.
   */
  getAddress(): Promise<Address> {
    if (!this.addressPromise) {
      this.addressPromise = this.deriveAddress();
    }
    return this.addressPromise;
  }

  /**
   * Sign a transaction: serialize -> keccak256 -> KMS sign -> DER decode -> assemble signed tx.
   */
  async signTransaction(tx: TransactionSerializable): Promise<Hex> {
    const serialized = serializeTransaction(tx);
    const digest = keccak256(serialized, 'bytes');

    const { r, s, yParity } = await this.signDigestAndRecover(digest);

    return serializeTransaction(tx, {
      r: toHex(r, { size: 32 }),
      s: toHex(s, { size: 32 }),
      yParity,
    } as Parameters<typeof serializeTransaction>[1]);
  }

  /**
   * Sign EIP-712 typed data. Returns {v, r, s} for permit-style calls.
   * v = yParity + 27 (legacy recovery id format expected by EIP-2612 selfPermit).
   */
  async signTypedData(params: SignTypedDataParams): Promise<SignatureComponents> {
    const hash = hashTypedData(params);
    const digest = hexToBytes(hash);

    const { r, s, yParity } = await this.signDigestAndRecover(digest);

    return {
      v: yParity + 27,
      r: toHex(r, { size: 32 }),
      s: toHex(s, { size: 32 }),
    };
  }

  /**
   * Health check: verify KMS key is configured correctly and address matches expectations.
   */
  async healthCheck(): Promise<void> {
    // 1. Verify key metadata
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

    // 2. Verify derived address matches expected address (if configured)
    if (this.expectedAddress) {
      const derivedAddress = await this.getAddress();
      if (derivedAddress.toLowerCase() !== this.expectedAddress.toLowerCase()) {
        throw new Error(
          `KMS derived address ${derivedAddress} does not match expected ${this.expectedAddress}`,
        );
      }
    }
  }

  /**
   * Internal: sign a 32-byte digest via KMS and resolve the recovery parameter.
   */
  private async signDigestAndRecover(
    digest: Uint8Array,
  ): Promise<{ r: Uint8Array; s: Uint8Array; yParity: number }> {
    const address = await this.getAddress();
    const derSignature = await this.kmsClient.signDigest(this.keyId, digest);

    const { r, s: rawS } = parseDerSignature(derSignature);
    const { r: normalizedR, s } = normalizeSignature(r, rawS);
    const yParity = await resolveRecoveryParam(digest, normalizedR, s, address);

    return { r: normalizedR, s, yParity };
  }

  /**
   * Internal: derive address from KMS public key.
   */
  private async deriveAddress(): Promise<Address> {
    const publicKey = await this.kmsClient.getPublicKey(this.keyId);
    return publicToAddress(publicKey);
  }
}

/** Convert a 0x-prefixed hex string to Uint8Array */
function hexToBytes(hex: Hex): Uint8Array {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
