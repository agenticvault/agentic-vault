import { describe, it, expect } from 'vitest';
import { aaveV3Decoder } from '@/protocols/decoders/aave-v3.js';
import { encodeFunctionData, type Address, type Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

const aaveV3Abi = [
  {
    name: 'supply' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'onBehalfOf', type: 'address' as const },
      { name: 'referralCode', type: 'uint16' as const },
    ],
    outputs: [],
  },
  {
    name: 'borrow' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'interestRateMode', type: 'uint256' as const },
      { name: 'referralCode', type: 'uint16' as const },
      { name: 'onBehalfOf', type: 'address' as const },
    ],
    outputs: [],
  },
  {
    name: 'repay' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'interestRateMode', type: 'uint256' as const },
      { name: 'onBehalfOf', type: 'address' as const },
    ],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
  {
    name: 'withdraw' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'to', type: 'address' as const },
    ],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
] as const;

const POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address;
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

// ============================================================================
// Tests
// ============================================================================

describe('aaveV3Decoder', () => {
  it('should have protocol "aave_v3"', () => {
    expect(aaveV3Decoder.protocol).toBe('aave_v3');
  });

  it('should support all 4 function selectors', () => {
    expect(aaveV3Decoder.supportedSelectors).toContain('0x617ba037'); // supply
    expect(aaveV3Decoder.supportedSelectors).toContain('0xa415bcad'); // borrow
    expect(aaveV3Decoder.supportedSelectors).toContain('0x573ade81'); // repay
    expect(aaveV3Decoder.supportedSelectors).toContain('0x69328dec'); // withdraw
  });

  describe('supply', () => {
    it('should decode supply calldata correctly', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [USDC, 1000000000n, USER, 0],
      });

      const result = aaveV3Decoder.decode(1, POOL_ADDRESS, data);

      expect(result.protocol).toBe('aave_v3');
      expect(result.chainId).toBe(1);
      expect(result.to).toBe(POOL_ADDRESS);
      if (result.protocol === 'aave_v3' && result.action === 'supply') {
        expect(result.args.asset).toBe(USDC);
        expect(result.args.amount).toBe(1000000000n);
        expect(result.args.onBehalfOf).toBe(USER);
        expect(result.args.referralCode).toBe(0);
      } else {
        expect.unreachable('Expected aave_v3 supply intent');
      }
    });
  });

  describe('borrow', () => {
    it('should decode borrow calldata correctly', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'borrow',
        args: [USDC, 500000000n, 2n, 0, USER],
      });

      const result = aaveV3Decoder.decode(1, POOL_ADDRESS, data);

      expect(result.protocol).toBe('aave_v3');
      if (result.protocol === 'aave_v3' && result.action === 'borrow') {
        expect(result.args.asset).toBe(USDC);
        expect(result.args.amount).toBe(500000000n);
        expect(result.args.interestRateMode).toBe(2n);
        expect(result.args.referralCode).toBe(0);
        expect(result.args.onBehalfOf).toBe(USER);
      } else {
        expect.unreachable('Expected aave_v3 borrow intent');
      }
    });
  });

  describe('repay', () => {
    it('should decode repay calldata correctly', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'repay',
        args: [USDC, 250000000n, 2n, USER],
      });

      const result = aaveV3Decoder.decode(1, POOL_ADDRESS, data);

      expect(result.protocol).toBe('aave_v3');
      if (result.protocol === 'aave_v3' && result.action === 'repay') {
        expect(result.args.asset).toBe(USDC);
        expect(result.args.amount).toBe(250000000n);
        expect(result.args.interestRateMode).toBe(2n);
        expect(result.args.onBehalfOf).toBe(USER);
      } else {
        expect.unreachable('Expected aave_v3 repay intent');
      }
    });
  });

  describe('withdraw', () => {
    it('should decode withdraw calldata correctly', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'withdraw',
        args: [USDC, 100000000n, USER],
      });

      const result = aaveV3Decoder.decode(1, POOL_ADDRESS, data);

      expect(result.protocol).toBe('aave_v3');
      if (result.protocol === 'aave_v3' && result.action === 'withdraw') {
        expect(result.args.asset).toBe(USDC);
        expect(result.args.amount).toBe(100000000n);
        expect(result.args.to).toBe(USER);
      } else {
        expect.unreachable('Expected aave_v3 withdraw intent');
      }
    });
  });

  describe('invalid calldata', () => {
    it('should return UnknownIntent for garbage data', () => {
      const data = '0x617ba037deadbeef' as Hex;
      const result = aaveV3Decoder.decode(1, POOL_ADDRESS, data);

      expect(result.protocol).toBe('unknown');
      if (result.protocol === 'unknown') {
        expect(result.reason).toContain('Failed to decode');
      }
    });

    it('should return UnknownIntent for unknown function selector', () => {
      const data = '0xdeadbeef0000000000000000000000001111111111111111111111111111111111111111' as Hex;
      const result = aaveV3Decoder.decode(1, POOL_ADDRESS, data);

      expect(result.protocol).toBe('unknown');
    });
  });
});
