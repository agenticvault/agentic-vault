import { describe, it, expect } from 'vitest';
import { erc20Evaluator } from '@/protocols/policy/evaluators/erc20.js';
import type { ProtocolPolicyConfig } from '@/protocols/policy/types.js';
import type { Erc20ApproveIntent, Erc20TransferIntent } from '@/protocols/types.js';
import type { Address, Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const SPENDER = '0x1111111111111111111111111111111111111111' as Address;
const RECIPIENT = '0x2222222222222222222222222222222222222222' as Address;
const UNKNOWN_ADDR = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address;

function createApproveIntent(
  overrides?: Partial<Erc20ApproveIntent['args']>,
): Erc20ApproveIntent {
  return {
    protocol: 'erc20',
    action: 'approve',
    chainId: 1,
    to: TOKEN,
    selector: '0x095ea7b3' as Hex,
    args: {
      spender: SPENDER,
      amount: 1000000000000000000n,
      ...overrides,
    },
  };
}

function createTransferIntent(
  overrides?: Partial<Erc20TransferIntent['args']>,
): Erc20TransferIntent {
  return {
    protocol: 'erc20',
    action: 'transfer',
    chainId: 1,
    to: TOKEN,
    selector: '0xa9059cbb' as Hex,
    args: {
      to: RECIPIENT,
      amount: 500000000000000000n,
      ...overrides,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('erc20Evaluator', () => {
  it('should have protocol "erc20"', () => {
    expect(erc20Evaluator.protocol).toBe('erc20');
  });

  // --- Token allowlist ---

  describe('tokenAllowlist', () => {
    it('should pass when token is in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [TOKEN],
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations.filter((v) => v.includes('token'))).toHaveLength(0);
    });

    it('should fail when token is not in allowlist', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [UNKNOWN_ADDR],
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('tokenAllowlist')]),
      );
    });

    it('should compare tokens case-insensitively', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [TOKEN.toLowerCase() as Address],
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations.filter((v) => v.includes('token'))).toHaveLength(0);
    });

    it('should skip check when tokenAllowlist is empty', () => {
      const config: ProtocolPolicyConfig = {
        tokenAllowlist: [],
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations.filter((v) => v.includes('token'))).toHaveLength(0);
    });
  });

  // --- Approve ---

  describe('approve', () => {
    it('should pass when spender is in recipientAllowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [SPENDER],
        maxAllowanceWei: 2000000000000000000n,
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations).toHaveLength(0);
    });

    it('should fail when spender is not in recipientAllowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('spender')]),
      );
    });

    it('should fail when approve amount exceeds maxAllowanceWei', () => {
      const config: ProtocolPolicyConfig = {
        maxAllowanceWei: 100n,
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('maxAllowanceWei')]),
      );
    });

    it('should pass when approve amount is within maxAllowanceWei', () => {
      const config: ProtocolPolicyConfig = {
        maxAllowanceWei: 2000000000000000000n,
      };
      const violations = erc20Evaluator.evaluate(createApproveIntent(), config);
      expect(violations.filter((v) => v.includes('maxAllowanceWei'))).toHaveLength(0);
    });
  });

  // --- Transfer ---

  describe('transfer', () => {
    it('should pass when recipient is in recipientAllowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [RECIPIENT],
        maxAllowanceWei: 1000000000000000000n,
      };
      const violations = erc20Evaluator.evaluate(createTransferIntent(), config);
      expect(violations).toHaveLength(0);
    });

    it('should fail when recipient is not in recipientAllowlist', () => {
      const config: ProtocolPolicyConfig = {
        recipientAllowlist: [UNKNOWN_ADDR],
      };
      const violations = erc20Evaluator.evaluate(createTransferIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('recipient')]),
      );
    });

    it('should fail when transfer amount exceeds maxAllowanceWei', () => {
      const config: ProtocolPolicyConfig = {
        maxAllowanceWei: 100n,
      };
      const violations = erc20Evaluator.evaluate(createTransferIntent(), config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('maxAllowanceWei')]),
      );
    });
  });

  // --- Non-erc20 intent guard ---

  describe('non-erc20 intent', () => {
    it('should return error for non-erc20 intent', () => {
      const config: ProtocolPolicyConfig = {};
      const fakeIntent = {
        protocol: 'uniswap_v3',
        action: 'exactInputSingle',
        chainId: 1,
        to: TOKEN,
        selector: '0x12345678' as Hex,
        args: {},
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const violations = erc20Evaluator.evaluate(fakeIntent as any, config);
      expect(violations).toEqual(
        expect.arrayContaining([expect.stringContaining('non-erc20')]),
      );
    });
  });
});
