import { describe, it, expect } from 'vitest';
import { aaveV3Evaluator } from '@/protocols/policy/evaluators/aave-v3.js';
import type { ProtocolPolicyConfig } from '@/protocols/policy/types.js';
import type {
  AaveV3SupplyIntent,
  AaveV3BorrowIntent,
  AaveV3RepayIntent,
  AaveV3WithdrawIntent,
} from '@/protocols/types.js';
import type { Address, Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address;
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;
const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
const UNKNOWN_ADDR = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address;

function createSupplyIntent(
  overrides?: Partial<AaveV3SupplyIntent['args']>,
): AaveV3SupplyIntent {
  return {
    protocol: 'aave_v3',
    action: 'supply',
    chainId: 1,
    to: POOL,
    selector: '0x617ba037' as Hex,
    args: {
      asset: USDC,
      amount: 1000000000n,
      onBehalfOf: USER,
      referralCode: 0,
      ...overrides,
    },
  };
}

function createBorrowIntent(
  overrides?: Partial<AaveV3BorrowIntent['args']>,
): AaveV3BorrowIntent {
  return {
    protocol: 'aave_v3',
    action: 'borrow',
    chainId: 1,
    to: POOL,
    selector: '0xa415bcad' as Hex,
    args: {
      asset: USDC,
      amount: 500000000n,
      interestRateMode: 2n,
      referralCode: 0,
      onBehalfOf: USER,
      ...overrides,
    },
  };
}

function createRepayIntent(
  overrides?: Partial<AaveV3RepayIntent['args']>,
): AaveV3RepayIntent {
  return {
    protocol: 'aave_v3',
    action: 'repay',
    chainId: 1,
    to: POOL,
    selector: '0x573ade81' as Hex,
    args: {
      asset: USDC,
      amount: 250000000n,
      interestRateMode: 2n,
      onBehalfOf: USER,
      ...overrides,
    },
  };
}

function createWithdrawIntent(
  overrides?: Partial<AaveV3WithdrawIntent['args']>,
): AaveV3WithdrawIntent {
  return {
    protocol: 'aave_v3',
    action: 'withdraw',
    chainId: 1,
    to: POOL,
    selector: '0x69328dec' as Hex,
    args: {
      asset: USDC,
      amount: 100000000n,
      to: USER,
      ...overrides,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('aaveV3Evaluator', () => {
  it('should have protocol "aave_v3"', () => {
    expect(aaveV3Evaluator.protocol).toBe('aave_v3');
  });

  // --- Token allowlist ---

  describe('tokenAllowlist', () => {
    it('should pass when asset is in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [USDC],
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations.filter((v) => v.includes('tokenAllowlist'))).toHaveLength(0);
    });

    it('should fail when asset is not in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [WETH], // USDC missing
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('asset')]),
      );
    });

    it('should compare tokens case-insensitively', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [USDC.toLowerCase() as Address],
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations.filter((v) => v.includes('tokenAllowlist'))).toHaveLength(0);
    });

    it('should skip check when tokenAllowlist is empty', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [],
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations.filter((v) => v.includes('tokenAllowlist'))).toHaveLength(0);
    });

    it('should check asset for all 4 actions', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [WETH], // USDC not allowed
      };

      for (const intent of [
        createSupplyIntent(),
        createBorrowIntent(),
        createRepayIntent(),
        createWithdrawIntent(),
      ]) {
        const violations = aaveV3Evaluator.evaluate(intent, config);
        expect(violations).toEqual(
          expect.arrayContaining([expect.stringContaining('not in tokenAllowlist')]),
        );
      }
    });
  });

  // --- Recipient allowlist ---

  describe('recipientAllowlist', () => {
    it('should pass when onBehalfOf is in allowlist (supply)', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [USER],
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations.filter((v) => v.includes('recipientAllowlist'))).toHaveLength(0);
    });

    it('should fail when onBehalfOf is not in allowlist (supply)', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('onBehalfOf')]),
      );
    });

    it('should check onBehalfOf for borrow', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = aaveV3Evaluator.evaluate(createBorrowIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('onBehalfOf')]),
      );
    });

    it('should check onBehalfOf for repay', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = aaveV3Evaluator.evaluate(createRepayIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('onBehalfOf')]),
      );
    });

    it('should check "to" field for withdraw (not onBehalfOf)', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = aaveV3Evaluator.evaluate(createWithdrawIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('not in recipientAllowlist')]),
      );
    });

    it('should pass withdraw when "to" is in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [USER],
      };
      const violations = aaveV3Evaluator.evaluate(createWithdrawIntent(), config);
      expect(violations.filter((v) => v.includes('recipientAllowlist'))).toHaveLength(0);
    });

    it('should compare recipients case-insensitively', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [USER.toLowerCase() as Address],
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations.filter((v) => v.includes('recipientAllowlist'))).toHaveLength(0);
    });
  });

  // --- maxInterestRateMode ---

  describe('maxInterestRateMode', () => {
    it('should pass when interestRateMode is within limit (borrow)', () => {
      const config: ProtocolPolicyConfig = {
        maxInterestRateMode: 2,
      };
      const violations = aaveV3Evaluator.evaluate(
        createBorrowIntent({ interestRateMode: 2n }),
        config,
      );
      expect(violations.filter((v) => v.includes('interestRateMode'))).toHaveLength(0);
    });

    it('should fail when interestRateMode exceeds limit (borrow)', () => {
      const config: ProtocolPolicyConfig = {
        maxInterestRateMode: 1,
      };
      const violations = aaveV3Evaluator.evaluate(
        createBorrowIntent({ interestRateMode: 2n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('interestRateMode')]),
      );
    });

    it('should fail when interestRateMode exceeds limit (repay)', () => {
      const config: ProtocolPolicyConfig = {
        maxInterestRateMode: 1,
      };
      const violations = aaveV3Evaluator.evaluate(
        createRepayIntent({ interestRateMode: 2n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('interestRateMode')]),
      );
    });

    it('should skip check when maxInterestRateMode is not set', () => {
      const config: ProtocolPolicyConfig = {};
      const violations = aaveV3Evaluator.evaluate(
        createBorrowIntent({ interestRateMode: 99n }),
        config,
      );
      expect(violations.filter((v) => v.includes('interestRateMode'))).toHaveLength(0);
    });
  });

  // --- maxAmountWei ---

  describe('maxAmountWei', () => {
    it('should pass when amount is within limit', () => {
      const config: ProtocolPolicyConfig = {
        maxAmountWei: 2000000000n,
      };
      const violations = aaveV3Evaluator.evaluate(
        createSupplyIntent({ amount: 1000000000n }),
        config,
      );
      expect(violations.filter((v) => v.includes('maxAmountWei'))).toHaveLength(0);
    });

    it('should fail when amount exceeds limit (supply)', () => {
      const config: ProtocolPolicyConfig = {
        maxAmountWei: 500000000n,
      };
      const violations = aaveV3Evaluator.evaluate(
        createSupplyIntent({ amount: 1000000000n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('exceeds maxAmountWei')]),
      );
    });

    it('should fail when amount exceeds limit (borrow)', () => {
      const config: ProtocolPolicyConfig = {
        maxAmountWei: 100000000n,
      };
      const violations = aaveV3Evaluator.evaluate(
        createBorrowIntent({ amount: 500000000n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('exceeds maxAmountWei')]),
      );
    });

    it('should fail when amount exceeds limit (repay)', () => {
      const config: ProtocolPolicyConfig = {
        maxAmountWei: 100000000n,
      };
      const violations = aaveV3Evaluator.evaluate(
        createRepayIntent({ amount: 250000000n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('exceeds maxAmountWei')]),
      );
    });

    it('should fail when amount exceeds limit (withdraw)', () => {
      const config: ProtocolPolicyConfig = {
        maxAmountWei: 50000000n,
      };
      const violations = aaveV3Evaluator.evaluate(
        createWithdrawIntent({ amount: 100000000n }),
        config,
      );
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('exceeds maxAmountWei')]),
      );
    });

    it('should skip check when maxAmountWei is not set', () => {
      const config: ProtocolPolicyConfig = {};
      const violations = aaveV3Evaluator.evaluate(
        createSupplyIntent({ amount: 999999999999999999n }),
        config,
      );
      expect(violations.filter((v) => v.includes('maxAmountWei'))).toHaveLength(0);
    });
  });

  // --- Combined policies ---

  describe('combined policies', () => {
    it('should return no violations for fully compliant supply', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [USDC],
        recipientAllowlist: [USER],
        maxAmountWei: 2000000000n,
      };
      const violations = aaveV3Evaluator.evaluate(createSupplyIntent(), config);
      expect(violations).toHaveLength(0);
    });

    it('should accumulate multiple violations', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [WETH], // USDC not allowed
        recipientAllowlist: [UNKNOWN_ADDR], // USER not allowed
        maxInterestRateMode: 1, // mode 2 exceeds
        maxAmountWei: 100000000n, // 500M exceeds
      };
      const violations = aaveV3Evaluator.evaluate(createBorrowIntent(), config);
      // asset + onBehalfOf + interestRateMode + amount = 4
      expect(violations.length).toBeGreaterThanOrEqual(4);
    });
  });

  // --- Unknown action guard ---

  describe('unknown action', () => {
    it('should return violation for unknown aave_v3 action (fail-closed)', () => {
      const config: ProtocolPolicyConfig = {};
      const fakeIntent = {
        protocol: 'aave_v3',
        action: 'unknownAction',
        chainId: 1,
        to: POOL,
        selector: '0x12345678' as Hex,
        args: {},
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const violations = aaveV3Evaluator.evaluate(fakeIntent as any, config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('Unknown aave_v3 action')]),
      );
    });
  });

  // --- Non-aave_v3 intent guard ---

  describe('non-aave_v3 intent', () => {
    it('should return error for non-aave_v3 intent', () => {
      const config: ProtocolPolicyConfig = {};
      const fakeIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: POOL,
        selector: '0x095ea7b3' as Hex,
        args: { spender: USER, amount: 100n },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const violations = aaveV3Evaluator.evaluate(fakeIntent as any, config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('non-aave_v3')]),
      );
    });
  });
});
