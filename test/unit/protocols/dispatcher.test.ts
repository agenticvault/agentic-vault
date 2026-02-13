import { describe, it, expect } from 'vitest';
import { ProtocolDispatcher } from '@/protocols/dispatcher.js';
import type { RegistryConfig } from '@/protocols/registry.js';
import type { ProtocolDecoder, DecodedIntent } from '@/protocols/types.js';
import type { Address, Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

function createMockDecoder(
  protocol: string,
  selectors: Hex[],
  decodeFn?: (chainId: number, to: Address, data: Hex) => DecodedIntent,
): ProtocolDecoder {
  return {
    protocol,
    supportedSelectors: selectors,
    decode: decodeFn ?? ((chainId, to, data) => ({
      protocol: 'unknown',
      chainId,
      to,
      rawData: data,
      reason: `mock-${protocol}`,
    })),
  };
}

const DUMMY_ADDRESS = '0xdead000000000000000000000000000000000001' as Address;

// ============================================================================
// Tests
// ============================================================================

describe('ProtocolDispatcher', () => {
  describe('short calldata', () => {
    it('should return UnknownIntent for empty calldata', () => {
      const config: RegistryConfig = { contracts: {}, interfaceDecoders: [] };
      const dispatcher = new ProtocolDispatcher(config);
      const result = dispatcher.dispatch(1, DUMMY_ADDRESS, '0x' as Hex);

      expect(result.protocol).toBe('unknown');
      expect(result).toHaveProperty('reason');
      if (result.protocol === 'unknown') {
        expect(result.reason).toContain('too short');
      }
    });

    it('should return UnknownIntent for calldata shorter than 4 bytes', () => {
      const config: RegistryConfig = { contracts: {}, interfaceDecoders: [] };
      const dispatcher = new ProtocolDispatcher(config);
      const result = dispatcher.dispatch(1, DUMMY_ADDRESS, '0x095ea7' as Hex);

      expect(result.protocol).toBe('unknown');
    });
  });

  describe('no decoder found', () => {
    it('should return UnknownIntent when no decoder matches', () => {
      const config: RegistryConfig = { contracts: {}, interfaceDecoders: [] };
      const dispatcher = new ProtocolDispatcher(config);

      // Valid length but no decoder registered for this selector
      const data = '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001' as Hex;
      const result = dispatcher.dispatch(1, DUMMY_ADDRESS, data);

      expect(result.protocol).toBe('unknown');
      if (result.protocol === 'unknown') {
        expect(result.reason).toContain('No registered decoder');
      }
    });
  });

  describe('valid decode delegation', () => {
    it('should delegate to matched decoder and return its result', () => {
      const expected: DecodedIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
        selector: '0x095ea7b3' as Hex,
        args: {
          spender: '0x1111111111111111111111111111111111111111' as Address,
          amount: 1000n,
        },
      };

      const decoder = createMockDecoder('erc20', ['0x095ea7b3'], () => expected);
      const config: RegistryConfig = {
        contracts: {},
        interfaceDecoders: [decoder],
      };

      const dispatcher = new ProtocolDispatcher(config);
      // Calldata with matching selector (>= 10 chars with 0x prefix)
      const data = '0x095ea7b30000000000000000000000001111111111111111111111111111111111111111' as Hex;
      const result = dispatcher.dispatch(1, DUMMY_ADDRESS, data);

      expect(result).toEqual(expected);
    });
  });

  describe('selector extraction', () => {
    it('should extract first 4 bytes as selector (case-insensitive)', () => {
      let capturedSelector: string | undefined;
      const decoder = createMockDecoder('test', ['0x095ea7b3'], (chainId, to, data) => {
        capturedSelector = data.slice(0, 10);
        return {
          protocol: 'unknown',
          chainId,
          to,
          rawData: data,
          reason: 'test',
        };
      });

      const config: RegistryConfig = {
        contracts: {},
        interfaceDecoders: [decoder],
      };

      const dispatcher = new ProtocolDispatcher(config);
      const data = '0x095EA7B30000000000000000000000000000000000000000000000000000000000000001' as Hex;
      dispatcher.dispatch(1, DUMMY_ADDRESS, data);

      expect(capturedSelector).toBeDefined();
    });
  });
});
