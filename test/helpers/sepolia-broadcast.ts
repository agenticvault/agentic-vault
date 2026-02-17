import type { Address, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import type { SignerAdapter } from '@/index.js';

const MAX_BROADCAST_RETRIES = 3;
const NONCE_POLL_INTERVAL_MS = 4_000;
const NONCE_POLL_TIMEOUT_MS = 60_000;

async function waitForNonceClear(
  publicClient: PublicClient,
  address: Address,
  staleNonce: number,
): Promise<boolean> {
  const deadline = Date.now() + NONCE_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const confirmed = await publicClient.getTransactionCount({
      address,
      blockTag: 'latest',
    });
    if (confirmed > staleNonce) return true;
    await new Promise((r) => setTimeout(r, NONCE_POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Sign a transaction via KMS signer and broadcast to Sepolia with retry logic.
 *
 * Handles:
 *  - `already known` — derives txHash via keccak256
 *  - `replacement transaction underpriced` / `nonce too low` — waits for
 *    pending tx to clear, then retries with fresh nonce (up to 3 attempts)
 */
export async function signAndBroadcast(
  publicClient: PublicClient,
  signer: SignerAdapter,
  address: Address,
  tx: { to: Address; data: `0x${string}`; value?: bigint },
): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
  let lastError = 'unknown';
  for (let attempt = 0; attempt < MAX_BROADCAST_RETRIES; attempt++) {
    const nonce = await publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    });

    const fees = await publicClient.estimateFeesPerGas();
    const gas = await publicClient.estimateGas({
      account: address,
      ...tx,
    });

    const signedTx = await signer.signTransaction({
      chainId: sepolia.id,
      type: 'eip1559',
      nonce,
      gas: gas + gas / 5n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      ...tx,
    });

    let txHash: `0x${string}`;
    try {
      txHash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTx,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already known/i.test(msg)) {
        const { keccak256 } = await import('viem');
        txHash = keccak256(signedTx);
      } else if (/replacement transaction underpriced|nonce too low/i.test(msg)) {
        console.warn(`  Attempt ${attempt + 1}: ${msg} — waiting for pending tx to clear...`);
        const cleared = await waitForNonceClear(publicClient, address, nonce);
        if (!cleared) {
          console.warn(`  Nonce ${nonce} did not clear within timeout — retrying with fresh nonce...`);
        }
        lastError = msg;
        continue;
      } else {
        throw err;
      }
    }

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 120_000,
      pollingInterval: 4_000,
    });

    return { txHash, blockNumber: receipt.blockNumber };
  }

  throw new Error(`Failed to broadcast after ${MAX_BROADCAST_RETRIES} retries (last: ${lastError})`);
}
