import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { ToolSigner } from '@/agentic/mcp/tools/shared.js';

/** Hardhat Account #0 — deterministic test key, NEVER use in production */
export const HARDHAT_0_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
export const HARDHAT_0_ADDRESS =
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;

/**
 * Real ToolSigner backed by viem's local account (secp256k1).
 * NOT a mock — performs actual cryptographic signing.
 * Safe for E2E tests where vi.fn() is forbidden.
 */
export class LocalEvmSigner implements ToolSigner {
  private readonly account: PrivateKeyAccount;

  constructor(key: `0x${string}` = HARDHAT_0_KEY) {
    this.account = privateKeyToAccount(key);
  }

  async getAddress(): Promise<`0x${string}`> {
    return this.account.address;
  }

  async signTransaction(tx: Record<string, unknown>): Promise<`0x${string}`> {
    // Provide EIP-1559 defaults so viem can serialize
    const serializable = {
      type: 'eip1559' as const,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      gas: 21000n,
      nonce: 0,
      ...tx,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.account.signTransaction(serializable as any);
  }

  async signTypedData(
    params: Record<string, unknown>,
  ): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hexSig = await this.account.signTypedData(params as any);
    // Parse 65-byte signature: r(32) + s(32) + v(1)
    const r = `0x${hexSig.slice(2, 66)}` as `0x${string}`;
    const s = `0x${hexSig.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(hexSig.slice(130, 132), 16);
    return { v, r, s };
  }

  async healthCheck(): Promise<void> {
    // Local account is always healthy — no external dependency
  }
}
