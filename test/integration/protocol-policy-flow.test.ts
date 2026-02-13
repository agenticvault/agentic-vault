import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import { ProtocolDispatcher, createDefaultRegistry } from '@/protocols/index.js';
import { PolicyEngine, erc20Evaluator } from '@/protocols/index.js';
import type { PolicyConfigV2 } from '@/protocols/index.js';

// ============================================================================
// Constants
// ============================================================================

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const SPENDER = '0x1111111111111111111111111111111111111111' as Address;
const RECIPIENT = '0x2222222222222222222222222222222222222222' as Address;
const UNAUTHORIZED_ADDR = '0x9999999999999999999999999999999999999999' as Address;

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

// ============================================================================
// Helpers
// ============================================================================

function createPermissiveConfig(overrides?: Partial<PolicyConfigV2>): PolicyConfigV2 {
  return {
    allowedChainIds: [1, 137],
    allowedContracts: [USDC.toLowerCase() as `0x${string}`],
    allowedSelectors: ['0x095ea7b3', '0xa9059cbb'], // approve + transfer
    maxAmountWei: 10n ** 18n, // 1 ETH
    maxDeadlineSeconds: 3600,
    protocolPolicies: {
      erc20: {
        tokenAllowlist: [USDC.toLowerCase() as Address],
        recipientAllowlist: [
          SPENDER.toLowerCase() as Address,
          RECIPIENT.toLowerCase() as Address,
        ],
        maxAllowanceWei: 10n ** 18n,
      },
    },
    ...overrides,
  };
}

// ============================================================================
// Tests: Full Dispatcher → Decoder → PolicyEngine → Evaluator chain
// ============================================================================

describe('Protocol → Policy integration flow', () => {
  let dispatcher: ProtocolDispatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    dispatcher = new ProtocolDispatcher(createDefaultRegistry());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- ERC-20 approve ---

  describe('ERC-20 approve', () => {
    it('should allow a valid ERC-20 approve within policy limits', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 500000000000000000n],
      });

      const intent = dispatcher.dispatch(1, USDC, data);
      expect(intent.protocol).toBe('erc20');

      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        amountWei: 500000000000000000n,
        intent,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny ERC-20 approve that exceeds maxAllowanceWei', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 2n * 10n ** 18n], // 2 ETH > maxAllowanceWei
      });

      const intent = dispatcher.dispatch(1, USDC, data);
      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        amountWei: 2n * 10n ** 18n,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('maxAllowanceWei')]),
      );
    });

    it('should deny ERC-20 approve when spender not in recipientAllowlist', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [UNAUTHORIZED_ADDR, 100n],
      });

      const intent = dispatcher.dispatch(1, USDC, data);
      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('recipientAllowlist')]),
      );
    });

    it('should deny when chainId not in allowedChainIds (V1 base check)', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const intent = dispatcher.dispatch(999, USDC, data);
      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 999,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('chainId')]),
      );
    });
  });

  // --- ERC-20 transfer ---

  describe('ERC-20 transfer', () => {
    it('should allow a valid ERC-20 transfer within policy limits', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [RECIPIENT, 500000000000000000n],
      });

      const intent = dispatcher.dispatch(1, USDC, data);
      expect(intent.protocol).toBe('erc20');

      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        amountWei: 500000000000000000n,
        intent,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny ERC-20 transfer when recipient not in recipientAllowlist', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [UNAUTHORIZED_ADDR, 100n],
      });

      const intent = dispatcher.dispatch(1, USDC, data);
      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('recipientAllowlist')]),
      );
    });
  });

  // --- Unknown protocol ---

  describe('unknown protocol', () => {
    it('should produce UnknownIntent for random calldata (no decoder) and apply V1 checks only', () => {
      const randomData = '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001' as Hex;
      const intent = dispatcher.dispatch(1, USDC, randomData);

      expect(intent.protocol).toBe('unknown');

      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: '0xdeadbeef' as Hex,
        intent,
      });

      // V1 base checks pass (chainId + contract + selector may fail)
      // Unknown intent should NOT trigger protocol-specific evaluator errors
      expect(result.violations.filter((v) => v.includes('evaluator'))).toHaveLength(0);
    });
  });

  // --- Fail-closed semantics ---

  describe('fail-closed semantics', () => {
    it('should deny when known protocol but no evaluator registered', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const intent = dispatcher.dispatch(1, USDC, data);

      // No evaluators passed to PolicyEngine
      const engine = new PolicyEngine(createPermissiveConfig(), []);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('No policy evaluator')]),
      );
    });

    it('should deny when known protocol but no protocolPolicies config', () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const intent = dispatcher.dispatch(1, USDC, data);

      // Config without protocolPolicies
      const config = createPermissiveConfig({ protocolPolicies: undefined });
      const engine = new PolicyEngine(config, [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('No policy evaluator')]),
      );
    });
  });

  // --- V1 backward compat ---

  describe('V1 backward compatibility', () => {
    it('should allow request without intent (V1 base checks only)', () => {
      const engine = new PolicyEngine(createPermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: USDC.toLowerCase() as `0x${string}`,
        selector: '0x095ea7b3' as Hex,
        amountWei: 100n,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
