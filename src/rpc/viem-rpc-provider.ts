import {
  createPublicClient,
  http,
  type PublicClient,
  type Chain,
  encodeFunctionData,
  decodeFunctionResult,
} from 'viem';
import { mainnet, sepolia, arbitrum, base, polygon } from 'viem/chains';
import { erc20BalanceOfAbi } from '../protocols/catalog.js';
import type { WorkflowRpcProvider } from '../protocols/workflows/types.js';

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  42161: arbitrum,
  8453: base,
  137: polygon,
};

export class ViemRpcProvider implements WorkflowRpcProvider {
  private clients = new Map<number, PublicClient>();
  private rpcUrl?: string;

  constructor(options?: { rpcUrl?: string }) {
    this.rpcUrl = options?.rpcUrl;
  }

  private getClient(chainId: number): PublicClient {
    const existing = this.clients.get(chainId);
    if (existing) return existing;

    const chain = CHAIN_MAP[chainId];
    if (!chain && !this.rpcUrl) {
      throw new Error(
        `Unsupported chainId ${chainId}. Provide --rpc-url or use a supported chain: ${Object.keys(CHAIN_MAP).join(', ')}`,
      );
    }

    const transport = this.rpcUrl ? http(this.rpcUrl) : http();
    const client = createPublicClient({
      chain: chain ?? { id: chainId, name: `Chain ${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [] } } },
      transport,
    });

    this.clients.set(chainId, client);
    return client;
  }

  async getBalance(chainId: number, address: `0x${string}`): Promise<bigint> {
    const client = this.getClient(chainId);
    return client.getBalance({ address });
  }

  async getErc20Balance(chainId: number, token: `0x${string}`, owner: `0x${string}`): Promise<bigint> {
    const client = this.getClient(chainId);
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
    const client = this.getClient(chainId);
    return client.getTransactionCount({ address, blockTag: 'pending' });
  }

  async estimateGas(chainId: number, tx: { from: `0x${string}`; to: `0x${string}`; value?: bigint; data?: `0x${string}` }): Promise<bigint> {
    const client = this.getClient(chainId);
    return client.estimateGas({
      account: tx.from,
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });
  }

  async getGasPrice(chainId: number): Promise<bigint> {
    const client = this.getClient(chainId);
    return client.getGasPrice();
  }

  async estimateFeesPerGas(chainId: number): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const client = this.getClient(chainId);
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
    const chain = CHAIN_MAP[chainId];
    return chain?.nativeCurrency?.symbol ?? 'ETH';
  }

  async sendRawTransaction(chainId: number, signedTx: `0x${string}`): Promise<`0x${string}`> {
    const client = this.getClient(chainId);
    return client.sendRawTransaction({ serializedTransaction: signedTx });
  }
}
