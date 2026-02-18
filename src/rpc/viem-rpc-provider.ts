import {
  createPublicClient,
  http,
  type PublicClient,
  type Chain,
  encodeFunctionData,
  decodeFunctionResult,
} from 'viem';
import { mainnet, sepolia, arbitrum, base, polygon, bsc, avalanche, optimism, gnosis, fantom } from 'viem/chains';
import { erc20BalanceOfAbi } from '../protocols/catalog.js';
import type { WorkflowRpcProvider } from '../protocols/workflows/types.js';

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  42161: arbitrum,
  8453: base,
  137: polygon,
  56: bsc,
  43114: avalanche,
  10: optimism,
  100: gnosis,
  250: fantom,
};

/** Default symbol for chains not in CHAIN_MAP and without an override */
const UNKNOWN_NATIVE_SYMBOL = 'NATIVE';

export class ViemRpcProvider implements WorkflowRpcProvider {
  private clients = new Map<number, PublicClient>();
  private pending = new Map<number, Promise<PublicClient>>();
  private rpcUrl?: string;
  private nativeCurrencyOverrides: Record<number, string>;

  constructor(options?: { rpcUrl?: string; nativeCurrencyOverrides?: Record<number, string> }) {
    this.rpcUrl = options?.rpcUrl;
    this.nativeCurrencyOverrides = options?.nativeCurrencyOverrides ?? {};
  }

  private async getClient(chainId: number): Promise<PublicClient> {
    const existing = this.clients.get(chainId);
    if (existing) return existing;

    const inflight = this.pending.get(chainId);
    if (inflight) return inflight;

    const promise = this.initClient(chainId);
    this.pending.set(chainId, promise);
    try {
      const client = await promise;
      this.clients.set(chainId, client);
      return client;
    } finally {
      this.pending.delete(chainId);
    }
  }

  private async initClient(chainId: number): Promise<PublicClient> {
    const chain = CHAIN_MAP[chainId];
    if (!chain && !this.rpcUrl) {
      throw new Error(
        `Unsupported chainId ${chainId}. Provide --rpc-url or use a supported chain: ${Object.keys(CHAIN_MAP).join(', ')}`,
      );
    }

    const transport = this.rpcUrl ? http(this.rpcUrl) : http();
    const symbol = this.getNativeCurrencySymbol(chainId);
    const client = createPublicClient({
      chain: chain ?? { id: chainId, name: `Chain ${chainId}`, nativeCurrency: { name: symbol, symbol, decimals: 18 }, rpcUrls: { default: { http: [] } } },
      transport,
    });

    // Validate that the RPC endpoint serves the expected chain
    if (this.rpcUrl) {
      const remoteChainId = await client.getChainId();
      if (remoteChainId !== chainId) {
        throw new Error(
          `Chain ID mismatch: requested ${chainId} but RPC endpoint returned ${remoteChainId}`,
        );
      }
    }

    return client;
  }

  async getBalance(chainId: number, address: `0x${string}`): Promise<bigint> {
    const client = await this.getClient(chainId);
    return client.getBalance({ address });
  }

  async getErc20Balance(chainId: number, token: `0x${string}`, owner: `0x${string}`): Promise<bigint> {
    const client = await this.getClient(chainId);
    const data = encodeFunctionData({
      abi: [erc20BalanceOfAbi],
      args: [owner],
    });
    const result = await client.call({
      to: token,
      data,
    });
    if (!result.data) {
      throw new Error(`ERC20 balanceOf call returned no data for token ${token}`);
    }
    const decoded = decodeFunctionResult({
      abi: [erc20BalanceOfAbi],
      data: result.data,
    });
    return decoded as unknown as bigint;
  }

  async getTransactionCount(chainId: number, address: `0x${string}`): Promise<number> {
    const client = await this.getClient(chainId);
    return client.getTransactionCount({ address, blockTag: 'pending' });
  }

  async estimateGas(chainId: number, tx: { from: `0x${string}`; to: `0x${string}`; value?: bigint; data?: `0x${string}` }): Promise<bigint> {
    const client = await this.getClient(chainId);
    return client.estimateGas({
      account: tx.from,
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });
  }

  async getGasPrice(chainId: number): Promise<bigint> {
    const client = await this.getClient(chainId);
    return client.getGasPrice();
  }

  async estimateFeesPerGas(chainId: number): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const client = await this.getClient(chainId);
    try {
      const fees = await client.estimateFeesPerGas();
      let maxFee = fees.maxFeePerGas;
      let maxPriority = fees.maxPriorityFeePerGas;

      if (maxFee == null || maxPriority == null) {
        const gasPrice = await client.getGasPrice();
        maxFee = maxFee ?? gasPrice * 2n;
        maxPriority = maxPriority ?? 1_500_000_000n;
      }

      return {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriority > maxFee ? maxFee : maxPriority,
      };
    } catch {
      const gasPrice = await client.getGasPrice();
      return {
        maxFeePerGas: gasPrice * 2n,
        maxPriorityFeePerGas: gasPrice < 1_500_000_000n ? gasPrice : 1_500_000_000n,
      };
    }
  }

  getNativeCurrencySymbol(chainId: number): string {
    const override = this.nativeCurrencyOverrides[chainId];
    if (override) return override;
    const chain = CHAIN_MAP[chainId];
    return chain?.nativeCurrency?.symbol ?? UNKNOWN_NATIVE_SYMBOL;
  }

  async sendRawTransaction(chainId: number, signedTx: `0x${string}`): Promise<`0x${string}`> {
    const client = await this.getClient(chainId);
    return client.sendRawTransaction({ serializedTransaction: signedTx });
  }
}
