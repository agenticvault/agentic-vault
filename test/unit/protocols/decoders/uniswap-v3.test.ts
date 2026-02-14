import { describe, it, expect } from 'vitest';
import { uniswapV3Decoder } from '@/protocols/decoders/uniswap-v3.js';
import { encodeFunctionData, type Address, type Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

const uniswapV3Abi = [
  {
    name: 'exactInputSingle',
    type: 'function' as const,
    stateMutability: 'payable' as const,
    inputs: [
      {
        name: 'params',
        type: 'tuple' as const,
        components: [
          { name: 'tokenIn', type: 'address' as const },
          { name: 'tokenOut', type: 'address' as const },
          { name: 'fee', type: 'uint24' as const },
          { name: 'recipient', type: 'address' as const },
          { name: 'amountIn', type: 'uint256' as const },
          { name: 'amountOutMinimum', type: 'uint256' as const },
          { name: 'sqrtPriceLimitX96', type: 'uint160' as const },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' as const }],
  },
] as const;

const SWAP_ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const RECIPIENT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

// ============================================================================
// Tests
// ============================================================================

describe('uniswapV3Decoder', () => {
  it('should have protocol "uniswap_v3"', () => {
    expect(uniswapV3Decoder.protocol).toBe('uniswap_v3');
  });

  it('should support exactInputSingle selector (0x04e45aaf)', () => {
    expect(uniswapV3Decoder.supportedSelectors).toContain('0x04e45aaf');
  });

  describe('exactInputSingle', () => {
    it('should decode exactInputSingle calldata correctly', () => {
      const data = encodeFunctionData({
        abi: uniswapV3Abi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 3000,
            recipient: RECIPIENT,
            amountIn: 1000000000000000000n,
            amountOutMinimum: 1800000000n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const result = uniswapV3Decoder.decode(1, SWAP_ROUTER, data);

      expect(result.protocol).toBe('uniswap_v3');
      expect(result.chainId).toBe(1);
      expect(result.to).toBe(SWAP_ROUTER);
      if (result.protocol === 'uniswap_v3' && result.action === 'exactInputSingle') {
        expect(result.args.tokenIn).toBe(WETH);
        expect(result.args.tokenOut).toBe(USDC);
        expect(result.args.fee).toBe(3000);
        expect(result.args.recipient).toBe(RECIPIENT);
        expect(result.args.amountIn).toBe(1000000000000000000n);
        expect(result.args.amountOutMinimum).toBe(1800000000n);
        expect(result.args.sqrtPriceLimitX96).toBe(0n);
      } else {
        expect.unreachable('Expected uniswap_v3 exactInputSingle intent');
      }
    });

    it('should preserve selector in lowercase', () => {
      const data = encodeFunctionData({
        abi: uniswapV3Abi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 500,
            recipient: RECIPIENT,
            amountIn: 100n,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const result = uniswapV3Decoder.decode(1, SWAP_ROUTER, data);
      expect(result.protocol).toBe('uniswap_v3');
      if (result.protocol !== 'unknown') {
        expect(result.selector).toMatch(/^0x[0-9a-f]+$/);
      }
    });

    it('should handle different fee tiers', () => {
      for (const fee of [100, 500, 3000, 10000]) {
        const data = encodeFunctionData({
          abi: uniswapV3Abi,
          functionName: 'exactInputSingle',
          args: [
            {
              tokenIn: WETH,
              tokenOut: USDC,
              fee,
              recipient: RECIPIENT,
              amountIn: 1000n,
              amountOutMinimum: 1n,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });

        const result = uniswapV3Decoder.decode(1, SWAP_ROUTER, data);
        if (result.protocol === 'uniswap_v3' && result.action === 'exactInputSingle') {
          expect(result.args.fee).toBe(fee);
        } else {
          expect.unreachable(`Expected uniswap_v3 intent for fee tier ${fee}`);
        }
      }
    });
  });

  describe('invalid calldata', () => {
    it('should return UnknownIntent for garbage data with valid selector', () => {
      const data = '0x04e45aafdeadbeef' as Hex;
      const result = uniswapV3Decoder.decode(1, SWAP_ROUTER, data);

      expect(result.protocol).toBe('unknown');
      if (result.protocol === 'unknown') {
        expect(result.reason).toContain('Failed to decode');
      }
    });

    it('should return UnknownIntent for unknown function selector', () => {
      const data =
        '0xdeadbeef0000000000000000000000001111111111111111111111111111111111111111' as Hex;
      const result = uniswapV3Decoder.decode(1, SWAP_ROUTER, data);

      expect(result.protocol).toBe('unknown');
    });
  });
});
