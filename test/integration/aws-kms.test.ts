import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { AwsKmsClient } from '@/kms-client.js';
import { KmsSignerAdapter } from '@/kms-signer.js';
import { publicToAddress } from '@/evm-signer.util.js';
import {
  type Address,
  keccak256,
  parseTransaction,
  recoverAddress,
  serializeTransaction,
  verifyTypedData,
} from 'viem';

/**
 * Integration test for AWS KMS signer.
 *
 * Required environment variables:
 *   SIGNER_KEY_ID               - AWS KMS key ID (secp256k1, sign-enabled)
 *   SIGNER_REGION               - AWS region (default: ap-northeast-1)
 *   SIGNER_EXPECTED_ADDRESS     - (optional) Expected Ethereum address
 *   SIGNER_RESTRICTED_KEY_ID    - KMS key ID with Sign permission denied
 *   AWS_PROFILE or AWS_ACCESS_KEY_ID/SECRET - AWS credentials
 *
 * Skip: Tests are skipped automatically when SIGNER_KEY_ID is not set
 *       or when AWS credentials are expired/invalid.
 */

const SIGNER_KEY_ID = process.env.SIGNER_KEY_ID;
const SIGNER_REGION = process.env.SIGNER_REGION ?? 'ap-northeast-1';
const SIGNER_EXPECTED_ADDRESS = process.env.SIGNER_EXPECTED_ADDRESS as Address | undefined;
const SIGNER_RESTRICTED_KEY_ID = process.env.SIGNER_RESTRICTED_KEY_ID;

const describeWithKms = SIGNER_KEY_ID ? describe : describe.skip;

/**
 * Probe AWS credentials by attempting a lightweight KMS call.
 * Returns true if credentials are valid, false otherwise.
 * Prints a user-friendly hint when credentials are expired.
 */
async function assertAwsCredentials(kmsClient: AwsKmsClient, keyId: string): Promise<void> {
  try {
    await kmsClient.getPublicKey(keyId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/token.*expired|credentials.*expired|sso.*login/i.test(msg)) {
      console.warn(
        '\n⚠️  AWS credentials expired — skipping KMS integration tests.\n' +
        '   Run `aws sso login` to refresh, then re-run tests.\n',
      );
    }
    throw err;
  }
}

// ============================================================================
// Core signing tests (requires sign-enabled key)
// ============================================================================

describeWithKms('AWS KMS Integration', () => {
  let kmsClient: AwsKmsClient;
  let signer: KmsSignerAdapter;
  let credentialsValid = true;

  beforeAll(async () => {
    kmsClient = new AwsKmsClient({ region: SIGNER_REGION });
    signer = new KmsSignerAdapter(kmsClient, {
      keyId: SIGNER_KEY_ID!,
      region: SIGNER_REGION,
      expectedAddress: SIGNER_EXPECTED_ADDRESS,
    });
    try {
      await assertAwsCredentials(kmsClient, SIGNER_KEY_ID!);
    } catch {
      credentialsValid = false;
    }
  });

  beforeEach((ctx) => {
    if (!credentialsValid) ctx.skip();
  });

  // --------------------------------------------------------------------------
  // Address derivation
  // --------------------------------------------------------------------------

  describe('address derivation', () => {
    it('should derive a valid Ethereum address from KMS public key', async () => {
      const address = await signer.getAddress();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);

      if (SIGNER_EXPECTED_ADDRESS) {
        expect(address.toLowerCase()).toBe(SIGNER_EXPECTED_ADDRESS.toLowerCase());
      }
    });

    it('should derive same address via raw public key and signer', async () => {
      const pubkey = await kmsClient.getPublicKey(SIGNER_KEY_ID!);
      const directAddress = publicToAddress(pubkey);
      const signerAddress = await signer.getAddress();
      expect(directAddress.toLowerCase()).toBe(signerAddress.toLowerCase());
    });

    it('should return consistent address on multiple calls', async () => {
      const addr1 = await signer.getAddress();
      const addr2 = await signer.getAddress();
      expect(addr1).toBe(addr2);
    });
  });

  // --------------------------------------------------------------------------
  // Health check
  // --------------------------------------------------------------------------

  it('should pass health check', async () => {
    await expect(signer.healthCheck()).resolves.toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Transaction signing with cryptographic verification
  // --------------------------------------------------------------------------

  describe('signTransaction', () => {
    it('should sign a transaction and recover the signer address', async () => {
      const address = await signer.getAddress();

      const tx = {
        to: address,
        value: 0n,
        nonce: 0,
        gas: 21000n,
        maxFeePerGas: 20000000000n,
        maxPriorityFeePerGas: 1000000000n,
        chainId: 1,
        type: 'eip1559' as const,
      };

      const signedTx = await signer.signTransaction(tx);
      expect(signedTx.startsWith('0x02')).toBe(true);

      // Cryptographic verification: recover address from signed tx
      const parsed = parseTransaction(signedTx);
      const unsignedHash = keccak256(serializeTransaction(tx));
      const recovered = await recoverAddress({
        hash: unsignedHash,
        signature: {
          r: parsed.r!,
          s: parsed.s!,
          yParity: parsed.yParity!,
        },
      });
      expect(recovered.toLowerCase()).toBe(address.toLowerCase());
    });

    it('should produce low-s signatures (EIP-2)', async () => {
      const address = await signer.getAddress();
      const SECP256K1_HALF_N =
        0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n / 2n;

      const tx = {
        to: address,
        value: 0n,
        nonce: 1,
        gas: 21000n,
        maxFeePerGas: 20000000000n,
        maxPriorityFeePerGas: 1000000000n,
        chainId: 1,
        type: 'eip1559' as const,
      };

      const signedTx = await signer.signTransaction(tx);
      const parsed = parseTransaction(signedTx);
      const sBigInt = BigInt(parsed.s!);
      expect(sBigInt <= SECP256K1_HALF_N).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // EIP-712 typed data signing with cryptographic verification
  // --------------------------------------------------------------------------

  describe('signTypedData', () => {
    it('should sign typed data and verify signature on-chain style', async () => {
      const address = await signer.getAddress();

      const typedData = {
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
          owner: address,
          spender: '0x0000000000000000000000000000000000000001',
          value: 1000000n,
          nonce: 0n,
          deadline: 1700000000n,
        },
      };

      const sig = await signer.signTypedData(typedData);

      expect(sig.v).toBeOneOf([27, 28]);
      expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/);
      expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/);

      // Cryptographic verification: verifyTypedData
      const isValid = await verifyTypedData({
        address,
        ...typedData,
        signature: {
          v: BigInt(sig.v),
          r: sig.r,
          s: sig.s,
        },
      });
      expect(isValid).toBe(true);
    });
  });
});

// ============================================================================
// Permission error tests (requires restricted key with Sign denied)
// ============================================================================

const describeWithRestricted =
  SIGNER_KEY_ID && SIGNER_RESTRICTED_KEY_ID ? describe : describe.skip;

describeWithRestricted('AWS KMS Permission Errors', () => {
  let kmsClient: AwsKmsClient;
  let credentialsValid = true;

  beforeAll(async () => {
    kmsClient = new AwsKmsClient({ region: SIGNER_REGION });
    try {
      await assertAwsCredentials(kmsClient, SIGNER_KEY_ID!);
    } catch {
      credentialsValid = false;
    }
  });

  beforeEach((ctx) => {
    if (!credentialsValid) ctx.skip();
  });

  it('should still derive address from restricted key (GetPublicKey allowed)', async () => {
    const signer = new KmsSignerAdapter(kmsClient, {
      keyId: SIGNER_RESTRICTED_KEY_ID!,
      region: SIGNER_REGION,
    });

    const address = await signer.getAddress();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('should fail signTransaction with AccessDeniedException on restricted key', async () => {
    const signer = new KmsSignerAdapter(kmsClient, {
      keyId: SIGNER_RESTRICTED_KEY_ID!,
      region: SIGNER_REGION,
    });

    const address = await signer.getAddress();

    const tx = {
      to: address,
      value: 0n,
      nonce: 0,
      gas: 21000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1000000000n,
      chainId: 1,
      type: 'eip1559' as const,
    };

    await expect(signer.signTransaction(tx)).rejects.toThrow(/AccessDeniedException|not authorized/i);
  });

  it('should fail signTypedData with AccessDeniedException on restricted key', async () => {
    const signer = new KmsSignerAdapter(kmsClient, {
      keyId: SIGNER_RESTRICTED_KEY_ID!,
      region: SIGNER_REGION,
    });

    const address = await signer.getAddress();

    await expect(
      signer.signTypedData({
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
        primaryType: 'Permit',
        message: {
          owner: address,
          spender: '0x0000000000000000000000000000000000000001',
          value: 1000000n,
          nonce: 0n,
          deadline: 1700000000n,
        },
      }),
    ).rejects.toThrow(/AccessDeniedException|not authorized/i);
  });

  it('should fail healthCheck with non-existent key ID', async () => {
    const signer = new KmsSignerAdapter(kmsClient, {
      keyId: '00000000-0000-0000-0000-000000000000',
      region: SIGNER_REGION,
    });

    await expect(signer.healthCheck()).rejects.toThrow();
  });
});
