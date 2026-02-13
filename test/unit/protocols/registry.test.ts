import { describe, it, expect } from 'vitest';
import {
  ProtocolRegistry,
  createDefaultRegistry,
  type RegistryConfig,
} from '@/protocols/registry.js';
import type { ProtocolDecoder, DecodedIntent } from '@/protocols/types.js';
import type { Address, Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

function createMockDecoder(protocol: string, selectors: Hex[]): ProtocolDecoder {
  return {
    protocol,
    supportedSelectors: selectors,
    decode(chainId: number, to: Address, data: Hex): DecodedIntent {
      return {
        protocol: 'unknown',
        chainId,
        to,
        rawData: data,
        reason: `mock-${protocol}`,
      };
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ProtocolRegistry', () => {
  describe('Stage 1: address lookup', () => {
    it('should resolve decoder by chainId:address match', () => {
      const decoder = createMockDecoder('uniswap_v3', ['0x12345678']);
      const config: RegistryConfig = {
        contracts: {
          '1:0xabcdef1234567890abcdef1234567890abcdef12': {
            protocol: 'uniswap_v3',
            decoder,
          },
        },
        interfaceDecoders: [],
      };

      const registry = new ProtocolRegistry(config);
      const result = registry.resolve(
        1,
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' as Address,
        '0x12345678' as Hex,
      );

      expect(result).toBe(decoder);
    });

    it('should return undefined when address does not match', () => {
      const config: RegistryConfig = {
        contracts: {
          '1:0xabcdef1234567890abcdef1234567890abcdef12': {
            protocol: 'uniswap_v3',
            decoder: createMockDecoder('uniswap_v3', ['0x12345678']),
          },
        },
        interfaceDecoders: [],
      };

      const registry = new ProtocolRegistry(config);
      const result = registry.resolve(
        1,
        '0x9999991234567890abcdef1234567890abcdef12' as Address,
        '0x12345678' as Hex,
      );

      expect(result).toBeUndefined();
    });

    it('should normalize mixed-case config keys for case-insensitive matching', () => {
      const decoder = createMockDecoder('uniswap_v3', ['0x12345678']);
      const config: RegistryConfig = {
        contracts: {
          // Checksummed key in config
          '1:0xABCDEF1234567890ABCDEF1234567890ABCDEF12': {
            protocol: 'uniswap_v3',
            decoder,
          },
        },
        interfaceDecoders: [],
      };

      const registry = new ProtocolRegistry(config);
      // Lowercase address at runtime
      const result = registry.resolve(
        1,
        '0xabcdef1234567890abcdef1234567890abcdef12' as Address,
        '0x12345678' as Hex,
      );

      expect(result).toBe(decoder);
    });

    it('should distinguish by chainId', () => {
      const decoder = createMockDecoder('uniswap_v3', ['0x12345678']);
      const config: RegistryConfig = {
        contracts: {
          '1:0xabcdef1234567890abcdef1234567890abcdef12': {
            protocol: 'uniswap_v3',
            decoder,
          },
        },
        interfaceDecoders: [],
      };

      const registry = new ProtocolRegistry(config);
      // Same address, different chainId
      const result = registry.resolve(
        42161,
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF12' as Address,
        '0x12345678' as Hex,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Stage 2: interface decoder fallback', () => {
    it('should resolve decoder by selector match', () => {
      const erc20 = createMockDecoder('erc20', ['0x095ea7b3', '0xa9059cbb']);
      const config: RegistryConfig = {
        contracts: {},
        interfaceDecoders: [erc20],
      };

      const registry = new ProtocolRegistry(config);
      const result = registry.resolve(
        1,
        '0xdead000000000000000000000000000000000001' as Address,
        '0x095ea7b3' as Hex,
      );

      expect(result).toBe(erc20);
    });

    it('should return undefined when no decoder matches selector', () => {
      const erc20 = createMockDecoder('erc20', ['0x095ea7b3', '0xa9059cbb']);
      const config: RegistryConfig = {
        contracts: {},
        interfaceDecoders: [erc20],
      };

      const registry = new ProtocolRegistry(config);
      const result = registry.resolve(
        1,
        '0xdead000000000000000000000000000000000001' as Address,
        '0xdeadbeef' as Hex,
      );

      expect(result).toBeUndefined();
    });

    it('should match selectors case-insensitively', () => {
      const erc20 = createMockDecoder('erc20', ['0x095ea7b3']);
      const config: RegistryConfig = {
        contracts: {},
        interfaceDecoders: [erc20],
      };

      const registry = new ProtocolRegistry(config);
      const result = registry.resolve(
        1,
        '0xdead000000000000000000000000000000000001' as Address,
        '0x095EA7B3' as Hex,
      );

      expect(result).toBe(erc20);
    });
  });

  describe('Stage 1 priority over Stage 2', () => {
    it('should prefer address match over selector fallback', () => {
      const addressDecoder = createMockDecoder('uniswap_v3', ['0x095ea7b3']);
      const interfaceDecoder = createMockDecoder('erc20', ['0x095ea7b3']);

      const config: RegistryConfig = {
        contracts: {
          '1:0xdead000000000000000000000000000000000001': {
            protocol: 'uniswap_v3',
            decoder: addressDecoder,
          },
        },
        interfaceDecoders: [interfaceDecoder],
      };

      const registry = new ProtocolRegistry(config);
      const result = registry.resolve(
        1,
        '0xdead000000000000000000000000000000000001' as Address,
        '0x095ea7b3' as Hex,
      );

      expect(result).toBe(addressDecoder);
    });
  });

  describe('createDefaultRegistry', () => {
    it('should return config with erc20 as interface decoder', () => {
      const config = createDefaultRegistry();
      expect(config.contracts).toEqual({});
      expect(config.interfaceDecoders).toHaveLength(1);
      expect(config.interfaceDecoders[0].protocol).toBe('erc20');
    });
  });
});
