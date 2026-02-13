import { describe, it, expect } from 'vitest';
import { erc20Decoder } from '@/protocols/decoders/erc20.js';
import { encodeFunctionData, type Address, type Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

const erc20Abi = [
  {
    name: 'approve',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'spender', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
  {
    name: 'transfer',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'to', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
] as const;

const TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const SPENDER = '0x1111111111111111111111111111111111111111' as Address;
const RECIPIENT = '0x2222222222222222222222222222222222222222' as Address;

// ============================================================================
// Tests
// ============================================================================

describe('erc20Decoder', () => {
  it('should have protocol "erc20"', () => {
    expect(erc20Decoder.protocol).toBe('erc20');
  });

  it('should support approve and transfer selectors', () => {
    expect(erc20Decoder.supportedSelectors).toContain('0x095ea7b3'); // approve
    expect(erc20Decoder.supportedSelectors).toContain('0xa9059cbb'); // transfer
  });

  describe('approve', () => {
    it('should decode approve calldata correctly', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 1000000000000000000n],
      });

      const result = erc20Decoder.decode(1, TOKEN_ADDRESS, data);

      expect(result.protocol).toBe('erc20');
      expect(result.chainId).toBe(1);
      expect(result.to).toBe(TOKEN_ADDRESS);
      if (result.protocol === 'erc20' && result.action === 'approve') {
        expect(result.args.spender).toBe(SPENDER);
        expect(result.args.amount).toBe(1000000000000000000n);
      } else {
        expect.unreachable('Expected erc20 approve intent');
      }
    });
  });

  describe('transfer', () => {
    it('should decode transfer calldata correctly', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [RECIPIENT, 500000000000000000n],
      });

      const result = erc20Decoder.decode(1, TOKEN_ADDRESS, data);

      expect(result.protocol).toBe('erc20');
      expect(result.chainId).toBe(1);
      expect(result.to).toBe(TOKEN_ADDRESS);
      if (result.protocol === 'erc20' && result.action === 'transfer') {
        expect(result.args.to).toBe(RECIPIENT);
        expect(result.args.amount).toBe(500000000000000000n);
      } else {
        expect.unreachable('Expected erc20 transfer intent');
      }
    });
  });

  describe('invalid calldata', () => {
    it('should return UnknownIntent for garbage data with valid selector', () => {
      // Valid approve selector but truncated/invalid args
      const data = '0x095ea7b3deadbeef' as Hex;
      const result = erc20Decoder.decode(1, TOKEN_ADDRESS, data);

      expect(result.protocol).toBe('unknown');
      if (result.protocol === 'unknown') {
        expect(result.reason).toContain('Failed to decode');
      }
    });

    it('should return UnknownIntent for unknown function selector', () => {
      // A selector that doesn't match approve or transfer
      // decodeFunctionData will throw because the selector isn't in the ABI
      const data = '0xdeadbeef0000000000000000000000001111111111111111111111111111111111111111' as Hex;
      const result = erc20Decoder.decode(1, TOKEN_ADDRESS, data);

      expect(result.protocol).toBe('unknown');
    });
  });
});
