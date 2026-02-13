import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolicyEngine } from '@/protocols/policy/engine.js';
import type {
  PolicyConfigV2,
  PolicyRequestV2,
  ProtocolPolicyConfig,
  ProtocolPolicyEvaluator,
} from '@/protocols/policy/types.js';
import type { DecodedIntent } from '@/protocols/types.js';
import type { Address, Hex } from 'viem';

// ============================================================================
// Helpers
// ============================================================================

function createConfigV2(overrides?: Partial<PolicyConfigV2>): PolicyConfigV2 {
  return {
    allowedChainIds: [1, 137],
    allowedContracts: ['0x1234567890abcdef1234567890abcdef12345678'],
    allowedSelectors: ['0x095ea7b3'],
    maxAmountWei: 1000000000000000000n,
    maxDeadlineSeconds: 3600,
    ...overrides,
  };
}

function createRequestV2(overrides?: Partial<PolicyRequestV2>): PolicyRequestV2 {
  return {
    chainId: 1,
    to: '0x1234567890abcdef1234567890abcdef12345678',
    selector: '0x095ea7b3',
    amountWei: 500000000000000000n,
    deadline: Math.floor(Date.now() / 1000) + 1800,
    ...overrides,
  };
}

function createMockEvaluator(violations: string[] = []): ProtocolPolicyEvaluator {
  return {
    protocol: 'erc20',
    evaluate: vi.fn().mockReturnValue(violations),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PolicyEngine V2', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- V1 backward compat ---

  describe('V1 backward compatibility', () => {
    it('should pass V1 request (no intent) with valid base checks', () => {
      const engine = new PolicyEngine(createConfigV2());
      const result = engine.evaluate(createRequestV2());
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny V1 request with invalid chainId', () => {
      const engine = new PolicyEngine(createConfigV2());
      const result = engine.evaluate(createRequestV2({ chainId: 999 }));
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('chainId')]),
      );
    });
  });

  // --- V2 intent-aware checks ---

  describe('V2 intent-aware checks', () => {
    it('should run evaluator when intent is present with matching protocol', () => {
      const evaluator = createMockEvaluator();
      const protocolConfig: ProtocolPolicyConfig = {
        tokenAllowlist: ['0x1234567890abcdef1234567890abcdef12345678' as Address],
      };
      const config = createConfigV2({
        protocolPolicies: { erc20: protocolConfig },
      });

      const intent: DecodedIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678' as Address,
        selector: '0x095ea7b3' as Hex,
        args: {
          spender: '0x1111111111111111111111111111111111111111' as Address,
          amount: 100n,
        },
      };

      const engine = new PolicyEngine(config, [evaluator]);
      engine.evaluate(createRequestV2({ intent }));

      expect(evaluator.evaluate).toHaveBeenCalledWith(intent, protocolConfig);
    });

    it('should aggregate violations from evaluator', () => {
      const evaluator = createMockEvaluator(['spender not allowed']);
      const config = createConfigV2({
        protocolPolicies: { erc20: { tokenAllowlist: [] } },
      });

      const intent: DecodedIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678' as Address,
        selector: '0x095ea7b3' as Hex,
        args: {
          spender: '0x1111111111111111111111111111111111111111' as Address,
          amount: 100n,
        },
      };

      const engine = new PolicyEngine(config, [evaluator]);
      const result = engine.evaluate(createRequestV2({ intent }));

      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('spender not allowed');
    });
  });

  // --- Fail-closed ---

  describe('fail-closed semantics', () => {
    it('should deny when no evaluator is registered for protocol', () => {
      const config = createConfigV2({
        protocolPolicies: { erc20: { tokenAllowlist: [] } },
      });

      const intent: DecodedIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678' as Address,
        selector: '0x095ea7b3' as Hex,
        args: {
          spender: '0x1111111111111111111111111111111111111111' as Address,
          amount: 100n,
        },
      };

      // No evaluators passed
      const engine = new PolicyEngine(config);
      const result = engine.evaluate(createRequestV2({ intent }));

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('No policy evaluator')]),
      );
    });

    it('should deny when no protocolConfig is registered for protocol', () => {
      const evaluator = createMockEvaluator();
      // No protocolPolicies defined
      const config = createConfigV2();

      const intent: DecodedIntent = {
        protocol: 'erc20',
        action: 'approve',
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678' as Address,
        selector: '0x095ea7b3' as Hex,
        args: {
          spender: '0x1111111111111111111111111111111111111111' as Address,
          amount: 100n,
        },
      };

      const engine = new PolicyEngine(config, [evaluator]);
      const result = engine.evaluate(createRequestV2({ intent }));

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('No policy evaluator')]),
      );
    });
  });

  // --- Unknown intent ---

  describe('unknown intent', () => {
    it('should skip V2 checks when intent is unknown', () => {
      const engine = new PolicyEngine(createConfigV2());
      const intent: DecodedIntent = {
        protocol: 'unknown',
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678' as Address,
        rawData: '0xdeadbeef' as Hex,
        reason: 'test',
      };

      const result = engine.evaluate(createRequestV2({ intent }));
      // Should only have base check results, no protocol-specific violations
      expect(result.violations.filter((v) => v.includes('evaluator'))).toHaveLength(0);
    });

    it('should skip V2 checks when intent is absent', () => {
      const engine = new PolicyEngine(createConfigV2());
      const result = engine.evaluate(createRequestV2());
      expect(result.allowed).toBe(true);
    });
  });
});
