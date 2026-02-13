import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolicyEngine } from '@/agentic/policy/engine.js';
import { type PolicyConfig, type PolicyRequest } from '@/agentic/policy/types.js';

// ============================================================================
// Helpers
// ============================================================================

function createConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
  return {
    allowedChainIds: [1, 137],
    allowedContracts: ['0x1234567890abcdef1234567890abcdef12345678'],
    allowedSelectors: ['0x38ed1739'], // swapExactTokensForTokens
    maxAmountWei: 1000000000000000000n, // 1 ETH
    maxDeadlineSeconds: 3600, // 1 hour
    ...overrides,
  };
}

function createRequest(overrides?: Partial<PolicyRequest>): PolicyRequest {
  return {
    chainId: 1,
    to: '0x1234567890abcdef1234567890abcdef12345678',
    selector: '0x38ed1739',
    amountWei: 500000000000000000n, // 0.5 ETH
    deadline: Math.floor(Date.now() / 1000) + 1800, // 30 min from now
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PolicyEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- chainId ---

  describe('chainId whitelist', () => {
    it('should allow a request with an allowed chainId', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ chainId: 1 }));
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny a request with a disallowed chainId', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ chainId: 42161 }));
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('chainId 42161')]),
      );
    });
  });

  // --- contract whitelist ---

  describe('contract whitelist', () => {
    it('should allow a request with an allowed contract', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest());
      expect(result.allowed).toBe(true);
    });

    it('should deny a request with a disallowed contract', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(
        createRequest({ to: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }),
      );
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('contract')]),
      );
    });

    it('should compare contracts case-insensitively', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(
        createRequest({ to: '0x1234567890ABCDEF1234567890ABCDEF12345678' }),
      );
      expect(result.allowed).toBe(true);
    });
  });

  // --- selector whitelist ---

  describe('selector whitelist', () => {
    it('should allow a request with an allowed selector', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ selector: '0x38ed1739' }));
      expect(result.allowed).toBe(true);
    });

    it('should deny a request with a disallowed selector', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ selector: '0xdeadbeef' }));
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('selector')]),
      );
    });

    it('should skip selector check when selector is undefined', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ selector: undefined }));
      expect(result.violations.filter((v) => v.includes('selector'))).toHaveLength(0);
    });
  });

  // --- amount limit ---

  describe('amount limit', () => {
    it('should allow a request under the amount limit', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ amountWei: 100n }));
      expect(result.allowed).toBe(true);
    });

    it('should allow a request at exactly the amount limit', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ amountWei: 1000000000000000000n }));
      expect(result.allowed).toBe(true);
    });

    it('should deny a request over the amount limit', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ amountWei: 2000000000000000000n }));
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('amount')]),
      );
    });

    it('should skip amount check when amountWei is undefined', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ amountWei: undefined }));
      expect(result.violations.filter((v) => v.includes('amount'))).toHaveLength(0);
    });
  });

  // --- deadline range ---

  describe('deadline range', () => {
    it('should allow a deadline within the allowed range', () => {
      const engine = new PolicyEngine(createConfig());
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = engine.evaluate(createRequest({ deadline: nowSeconds + 1800 }));
      expect(result.allowed).toBe(true);
    });

    it('should deny a deadline in the past', () => {
      const engine = new PolicyEngine(createConfig());
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = engine.evaluate(createRequest({ deadline: nowSeconds - 100 }));
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('past')]),
      );
    });

    it('should deny a deadline too far in the future', () => {
      const engine = new PolicyEngine(createConfig());
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = engine.evaluate(createRequest({ deadline: nowSeconds + 7200 }));
      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('exceeds max')]),
      );
    });

    it('should skip deadline check when deadline is undefined', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest({ deadline: undefined }));
      expect(result.violations.filter((v) => v.includes('deadline'))).toHaveLength(0);
    });
  });

  // --- multiple violations ---

  describe('multiple violations', () => {
    it('should return all violations, not just the first', () => {
      const engine = new PolicyEngine(createConfig());
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = engine.evaluate({
        chainId: 999,
        to: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        selector: '0xdeadbeef',
        amountWei: 9999999999999999999n,
        deadline: nowSeconds - 100,
      });
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(5);
    });
  });

  // --- empty config ---

  describe('empty config (deny all)', () => {
    it('should deny all requests when config has empty whitelists', () => {
      const engine = new PolicyEngine({
        allowedChainIds: [],
        allowedContracts: [],
        allowedSelectors: [],
        maxAmountWei: 0n,
        maxDeadlineSeconds: 0,
      });
      const result = engine.evaluate(createRequest());
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  // --- full valid request ---

  describe('full valid request', () => {
    it('should pass with all dimensions valid', () => {
      const engine = new PolicyEngine(createConfig());
      const result = engine.evaluate(createRequest());
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
