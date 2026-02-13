import {
  type Address,
  type Hex,
  type TransactionSerializable,
  hashTypedData,
  keccak256,
  serializeTransaction,
  toHex,
} from 'viem';
import type { SigningProvider } from './signing-provider.js';
import type { SignTypedDataParams, SignatureComponents, SignerAdapter } from '../types.js';
import {
  normalizeSignature,
  parseDerSignature,
  publicToAddress,
  resolveRecoveryParam,
} from '../evm-signer.util.js';

export interface EvmSignerAdapterConfig {
  expectedAddress?: Address;
}

/**
 * EVM signing adapter that delegates to a SigningProvider.
 * Same orchestration logic as KmsSignerAdapter but provider-agnostic.
 */
export class EvmSignerAdapter implements SignerAdapter {
  private readonly expectedAddress?: Address;
  private readonly provider: SigningProvider;
  private addressPromise: Promise<Address> | null = null;

  constructor(provider: SigningProvider, config?: EvmSignerAdapterConfig) {
    this.provider = provider;
    this.expectedAddress = config?.expectedAddress;
  }

  /**
   * Get the Ethereum address derived from the provider's public key.
   * Uses promise memoization to avoid concurrent calls during cold start.
   */
  getAddress(): Promise<Address> {
    if (!this.addressPromise) {
      this.addressPromise = this.deriveAddress();
    }
    return this.addressPromise;
  }

  /**
   * Sign a transaction: serialize -> keccak256 -> provider sign -> DER decode -> assemble signed tx.
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
   * Health check: verify provider is healthy and address matches expectations.
   */
  async healthCheck(): Promise<void> {
    await this.provider.healthCheck();

    if (this.expectedAddress) {
      const derivedAddress = await this.getAddress();
      if (derivedAddress.toLowerCase() !== this.expectedAddress.toLowerCase()) {
        throw new Error(
          `Derived address ${derivedAddress} does not match expected ${this.expectedAddress}`,
        );
      }
    }
  }

  /**
   * Internal: sign a 32-byte digest via provider and resolve the recovery parameter.
   */
  private async signDigestAndRecover(
    digest: Uint8Array,
  ): Promise<{ r: Uint8Array; s: Uint8Array; yParity: number }> {
    const address = await this.getAddress();
    const signatureBlob = await this.provider.signDigest(digest);

    const { r, s: rawS } = parseDerSignature(signatureBlob.bytes);
    const { r: normalizedR, s } = normalizeSignature(r, rawS);
    const yParity = await resolveRecoveryParam(digest, normalizedR, s, address);

    return { r: normalizedR, s, yParity };
  }

  /**
   * Internal: derive address from provider's public key.
   */
  private async deriveAddress(): Promise<Address> {
    const publicKeyBlob = await this.provider.getPublicKey();
    return publicToAddress(publicKeyBlob.bytes);
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
