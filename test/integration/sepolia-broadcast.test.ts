import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
  parseEther,
} from 'viem';
import { sepolia } from 'viem/chains';
import {
  createSigningProvider,
  EvmSignerAdapter,
  type SignerAdapter,
} from '@/index.js';

/**
 * Sepolia testnet broadcast integration tests.
 *
 * Exercises the full signing → broadcast → receipt flow using
 * the Provider Abstraction layer (createSigningProvider + EvmSignerAdapter).
 *
 * Required environment variables:
 *   SIGNER_KEY_ID      - AWS KMS key ID (secp256k1, sign-enabled)
 *   SIGNER_REGION      - AWS region (default: ap-northeast-1)
 *   AWS_PROFILE or AWS_ACCESS_KEY_ID/SECRET - AWS credentials
 *
 * Optional:
 *   SEPOLIA_RPC_URL    - Custom Sepolia RPC endpoint (defaults to https://ethereum-sepolia-rpc.publicnode.com)
 *
 * Skip: Tests are skipped automatically when SIGNER_KEY_ID is not set,
 *       or when the signer address has insufficient balance.
 */

// ============================================================================
// Environment
// ============================================================================

const SIGNER_KEY_ID = process.env.SIGNER_KEY_ID;
const SIGNER_REGION = process.env.SIGNER_REGION ?? 'ap-northeast-1';
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

/** Minimum balance required to run broadcast tests (0.001 ETH) */
const MIN_BALANCE_WEI = parseEther('0.001');

const describeWithTestnet = SIGNER_KEY_ID ? describe.sequential : describe.skip;

// ============================================================================
// Tests
// ============================================================================

describeWithTestnet('Sepolia Broadcast', () => {
  let signer: SignerAdapter;
  let publicClient: PublicClient;
  let signerAddress: Address;
  let suiteSkipped = false;

  beforeAll(async () => {
    // --- Create signer via Provider Abstraction layer ---
    const provider = createSigningProvider({
      provider: 'aws-kms',
      keyId: SIGNER_KEY_ID!,
      region: SIGNER_REGION,
    });
    signer = new EvmSignerAdapter(provider);

    // --- Create public client ---
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    });

    // --- Safety: assert we're really on Sepolia ---
    try {
      const chainId = await publicClient.getChainId();
      if (chainId !== sepolia.id) {
        console.warn(
          `\n  RPC returned chainId ${chainId}, expected ${sepolia.id} (Sepolia). Skipping.\n`,
        );
        suiteSkipped = true;
        return;
      }
    } catch (err: unknown) {
      console.warn(
        `\n  RPC connection failed (${err instanceof Error ? err.message : String(err)}).` +
          '\n  Set SEPOLIA_RPC_URL to a reliable endpoint — skipping broadcast tests.\n',
      );
      suiteSkipped = true;
      return;
    }

    // --- Derive signer address ---
    try {
      signerAddress = await signer.getAddress();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/token.*expired|credentials.*expired|sso.*login/i.test(msg)) {
        console.warn(
          '\n  AWS credentials expired — skipping Sepolia broadcast tests.\n' +
            '  Run `aws sso login` to refresh, then re-run tests.\n',
        );
        suiteSkipped = true;
        return;
      }
      // Non-auth errors are real failures — rethrow
      throw err;
    }

    // --- Balance check ---
    try {
      const balance = await publicClient.getBalance({ address: signerAddress });
      if (balance < MIN_BALANCE_WEI) {
        console.warn(
          `\n  Signer ${signerAddress} has ${balance} wei on Sepolia (need >= ${MIN_BALANCE_WEI}).` +
            '\n  Fund via faucet: https://sepoliafaucet.com/ — skipping broadcast tests.\n',
        );
        suiteSkipped = true;
      }
    } catch (err: unknown) {
      console.warn(
        `\n  Balance check failed (${err instanceof Error ? err.message : String(err)}).` +
          '\n  Set SEPOLIA_RPC_URL to a reliable endpoint — skipping broadcast tests.\n',
      );
      suiteSkipped = true;
    }
  }, 60_000);

  beforeEach((ctx) => {
    if (suiteSkipped) ctx.skip();
  });

  // --------------------------------------------------------------------------
  // 1. Address derivation via factory
  // --------------------------------------------------------------------------

  it('should derive a valid Ethereum address via Provider Abstraction', () => {
    expect(signerAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  // --------------------------------------------------------------------------
  // 2–5. Sign, broadcast, verify receipt, nonce progression
  // --------------------------------------------------------------------------

  describe('self-transfer broadcast', () => {
    let txHash: `0x${string}`;
    let nonceBefore: number;

    it('should sign an EIP-1559 self-transfer with on-chain gas estimates', async () => {
      // Query nonce
      nonceBefore = await publicClient.getTransactionCount({
        address: signerAddress,
        blockTag: 'pending',
      });

      // Estimate gas parameters
      const fees = await publicClient.estimateFeesPerGas();
      const maxFeePerGas = fees.maxFeePerGas;
      const maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      if (maxFeePerGas == null || maxPriorityFeePerGas == null) {
        throw new Error(
          'RPC did not return EIP-1559 fee estimates. Set SEPOLIA_RPC_URL to an EIP-1559 compatible endpoint.',
        );
      }

      const gas = await publicClient.estimateGas({
        account: signerAddress,
        to: signerAddress,
        value: 0n,
      });

      // Sign
      const signedTx = await signer.signTransaction({
        chainId: sepolia.id,
        type: 'eip1559',
        to: signerAddress,
        value: 0n,
        nonce: nonceBefore,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      expect(signedTx).toMatch(/^0x02/); // EIP-1559 prefix

      // Broadcast with "already known" tolerance (same tx resubmitted)
      try {
        txHash = await publicClient.sendRawTransaction({
          serializedTransaction: signedTx,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already known/i.test(msg)) {
          // Same tx already in mempool (e.g., test retry) — derive hash locally
          const { keccak256 } = await import('viem');
          txHash = keccak256(signedTx);
          console.warn(`  Rebroadcast detected (${msg}), continuing with hash ${txHash}`);
        } else {
          // Nonce collisions or other errors should fail fast
          throw err;
        }
      }

      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    }, 30_000);

    it('should confirm the transaction with a valid receipt', async () => {
      expect(txHash).toBeDefined();

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 120_000,
        pollingInterval: 4_000,
      });

      expect(receipt.status).toBe('success');
      expect(receipt.from.toLowerCase()).toBe(signerAddress.toLowerCase());
      expect(receipt.to?.toLowerCase()).toBe(signerAddress.toLowerCase());
      expect(receipt.blockNumber).toBeGreaterThan(0n);
      expect(receipt.transactionHash).toBe(txHash);
    }, 130_000);

    it('should advance the pending nonce after confirmation', async () => {
      expect(nonceBefore).toBeDefined();

      const nonceAfter = await publicClient.getTransactionCount({
        address: signerAddress,
        blockTag: 'pending',
      });

      expect(nonceAfter).toBeGreaterThan(nonceBefore);
    }, 10_000);
  });
});
