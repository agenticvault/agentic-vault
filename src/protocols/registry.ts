import type { Address, Hex } from 'viem';
import type { ProtocolDecoder } from './types.js';
import { erc20Decoder } from './decoders/erc20.js';

export interface ContractEntry {
  protocol: string;
  decoder: ProtocolDecoder;
}

export interface RegistryConfig {
  contracts: Record<string, ContractEntry>; // key: `${chainId}:${lowercase address}`
  interfaceDecoders: ProtocolDecoder[]; // fallback: match by selector (e.g., ERC-20)
}

export class ProtocolRegistry {
  private readonly addressMap: Map<string, ContractEntry>;
  private readonly interfaceDecoders: ProtocolDecoder[];

  constructor(config: RegistryConfig) {
    // Normalize keys to lowercase for case-insensitive address matching
    this.addressMap = new Map(
      Object.entries(config.contracts).map(([key, entry]) => [key.toLowerCase(), entry]),
    );
    this.interfaceDecoders = config.interfaceDecoders;
  }

  /**
   * Lookup protocol by chainId + contract address (Stage 1).
   * Falls back to interface-based decoder matching by selector (Stage 2).
   */
  resolve(chainId: number, to: Address, selector: Hex): ProtocolDecoder | undefined {
    const key = `${chainId}:${to.toLowerCase()}`;
    const entry = this.addressMap.get(key);
    if (entry) return entry.decoder;

    const normalizedSelector = selector.toLowerCase() as Hex;
    return this.interfaceDecoders.find((d) =>
      d.supportedSelectors.some((s) => s.toLowerCase() === normalizedSelector),
    );
  }
}

export function createDefaultRegistry(): RegistryConfig {
  return {
    contracts: {},
    interfaceDecoders: [erc20Decoder],
  };
}
