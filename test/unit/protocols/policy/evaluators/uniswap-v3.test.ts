import { describe, it, expect } from 'vitest';
import { uniswapV3Evaluator } from '@/protocols/policy/evaluators/uniswap-v3.js';
import type { ProtocolPolicyConfig } from '@/protocols/policy/types.js';
import type { UniswapV3ExactInputSingleIntent } from '@/protocols/types.js';
import type { Address, Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

const SWAP_ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const RECIPIENT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
const UNKNOWN_ADDR = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address;

function createExactInputSingleIntent(
  overrides?: Partial<UniswapV3ExactInputSingleIntent['args']>,
): UniswapV3ExactInputSingleIntent {
  return {
    protocol: 'uniswap_v3',
    action: 'exactInputSingle',
    chainId: 1,
    to: SWAP_ROUTER,
    selector: '0x04e45aaf' as Hex,
    args: {
      tokenIn: WETH,
      tokenOut: USDC,
      fee: 3000,
      recipient: RECIPIENT,
      amountIn: 1000000000000000000n,
      amountOutMinimum: 1800000000n,
      sqrtPriceLimitX96: 0n,
      ...overrides,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('uniswapV3Evaluator', () => {
  it('should have protocol "uniswap_v3"', () => {
    expect(uniswapV3Evaluator.protocol).toBe('uniswap_v3');
  });

  // --- Token allowlist ---

  describe('tokenAllowlist', () => {
    it('should pass when both tokenIn and tokenOut are in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [WETH, USDC],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations.filter((v) => v.includes('token'))).toHaveLength(0);
    });

    it('should fail when tokenIn is not in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [USDC], // WETH missing
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('tokenIn')]),
      );
    });

    it('should fail when tokenOut is not in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [WETH], // USDC missing
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('tokenOut')]),
      );
    });

    it('should fail for both tokens when neither is in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [UNKNOWN_ADDR],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations.filter((v) => v.includes('tokenAllowlist'))).toHaveLength(2);
    });

    it('should compare tokens case-insensitively', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [
          WETH.toLowerCase() as Address,
          USDC.toLowerCase() as Address,
        ],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations.filter((v) => v.includes('token'))).toHaveLength(0);
    });

    it('should skip check when tokenAllowlist is empty', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations.filter((v) => v.includes('token'))).toHaveLength(0);
    });
  });

  // --- Recipient allowlist ---

  describe('recipientAllowlist', () => {
    it('should pass when recipient is in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [RECIPIENT],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations.filter((v) => v.includes('recipient'))).toHaveLength(0);
    });

    it('should fail when recipient is not in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('recipient')]),
      );
    });

    it('should compare recipients case-insensitively', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [RECIPIENT.toLowerCase() as Address],
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations.filter((v) => v.includes('recipient'))).toHaveLength(0);
    });
  });

  // --- Slippage protection ---

  describe('maxSlippageBps', () => {
    it('should pass when amountOutMinimum > 0 and maxSlippageBps is set', () => {
      const config: ProtocolPolicyConfig = {
        maxSlippageBps: 50, // 0.5%
      };
      const violations = uniswapV3Evaluator.evaluate(
        createExactInputSingleIntent({ amountOutMinimum: 1800000000n }),
        config,
      );
      expect(violations.filter((v) => v.includes('slippage'))).toHaveLength(0);
    });

    it('should fail when amountOutMinimum is 0 and maxSlippageBps is set', () => {
      const config: ProtocolPolicyConfig = {
        maxSlippageBps: 50,
      };
      const violations = uniswapV3Evaluator.evaluate(
        createExactInputSingleIntent({ amountOutMinimum: 0n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('amountOutMinimum is 0')]),
      );
    });

    it('should skip slippage check when maxSlippageBps is not set', () => {
      const config: ProtocolPolicyConfig = {};
      const violations = uniswapV3Evaluator.evaluate(
        createExactInputSingleIntent({ amountOutMinimum: 0n }),
        config,
      );
      expect(violations.filter((v) => v.includes('slippage'))).toHaveLength(0);
    });
  });

  // --- Combined policies ---

  describe('combined policies', () => {
    it('should return no violations for fully compliant swap', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [WETH, USDC],
        recipientAllowlist: [RECIPIENT],
        maxSlippageBps: 100,
      };
      const violations = uniswapV3Evaluator.evaluate(createExactInputSingleIntent(), config);
      expect(violations).toHaveLength(0);
    });

    it('should accumulate multiple violations', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [UNKNOWN_ADDR],
        recipientAllowlist: [UNKNOWN_ADDR],
        maxSlippageBps: 50,
      };
      const violations = uniswapV3Evaluator.evaluate(
        createExactInputSingleIntent({ amountOutMinimum: 0n }),
        config,
      );
      // tokenIn + tokenOut + recipient + slippage = 4
      expect(violations.length).toBeGreaterThanOrEqual(4);
    });
  });

  // --- Unknown action guard ---

  describe('unknown action', () => {
    it('should return violation for unknown uniswap_v3 action (fail-closed)', () => {
      const config: ProtocolPolicyConfig = {};
      const fakeIntent = {
        protocol: 'uniswap_v3',
        action: 'unknownAction',
        chainId: 1,
        to: SWAP_ROUTER,
        selector: '0x12345678' as Hex,
        args: {},
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const violations = uniswapV3Evaluator.evaluate(fakeIntent as any, config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('Unknown uniswap_v3 action')]),
      );
    });
  });

  // --- Non-uniswap_v3 intent guard ---

  describe('non-uniswap_v3 intent', () => {
    it('should return error for non-uniswap_v3 intent', () => {
      const config: ProtocolPolicyConfig = {};
      const fakeIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: SWAP_ROUTER,
        selector: '0x095ea7b3' as Hex,
        args: { spender: RECIPIENT, amount: 100n },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const violations = uniswapV3Evaluator.evaluate(fakeIntent as any, config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('non-uniswap_v3')]),
      );
    });
  });
});
