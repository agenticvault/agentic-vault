import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import { ProtocolDispatcher, createDefaultRegistry } from '@/protocols/index.js';
import { PolicyEngine, erc20Evaluator, aaveV3Evaluator } from '@/protocols/index.js';
import type { PolicyConfigV2 } from '@/protocols/index.js';

// ============================================================================
// Constants
// ============================================================================

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const SPENDER = '0x1111111111111111111111111111111111111111' as Address;
const RECIPIENT = '0x2222222222222222222222222222222222222222' as Address;
const UNAUTHORIZED_ADDR = '0x9999999999999999999999999999999999999999' as Address;
const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address;

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

  // --- Aave V3 supply ---

  describe('Aave V3 supply', () => {
    function createAavePermissiveConfig(overrides?: Partial<PolicyConfigV2>): PolicyConfigV2 {
      return {
        allowedChainIds: [1],
        allowedContracts: [AAVE_V3_POOL.toLowerCase() as `0x${string}`, USDC.toLowerCase() as `0x${string}`],
        allowedSelectors: ['0x617ba037', '0xa415bcad', '0x573ade81', '0x69328dec', '0x095ea7b3'],
        maxAmountWei: 10n ** 18n,
        maxDeadlineSeconds: 3600,
        protocolPolicies: {
          aave_v3: {
            tokenAllowlist: [USDC.toLowerCase() as Address],
            recipientAllowlist: [
              RECIPIENT.toLowerCase() as Address,
            ],
            maxAmountWei: 10n ** 18n,
            maxInterestRateMode: 2,
          },
          erc20: {
            tokenAllowlist: [USDC.toLowerCase() as Address],
            recipientAllowlist: [
              AAVE_V3_POOL.toLowerCase() as Address,
            ],
            maxAllowanceWei: 10n ** 18n,
          },
        },
        ...overrides,
      };
    }

    it('should allow a valid Aave V3 supply within policy limits', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [USDC, 500000000n, RECIPIENT, 0],
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      expect(intent.protocol).toBe('aave_v3');
      expect(intent.protocol !== 'unknown' && 'action' in intent ? intent.action : '').toBe('supply');

      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny Aave V3 borrow when interestRateMode exceeds maxInterestRateMode', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'borrow',
        args: [USDC, 100000000n, 3n, 0, RECIPIENT], // interestRateMode=3 > max=2
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('interestRateMode')]),
      );
    });

    it('should accumulate multiple violations (token + recipient + amount)', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [UNAUTHORIZED_ADDR, 2n * 10n ** 18n, UNAUTHORIZED_ADDR, 0], // wrong token, wrong recipient, too much
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      // tokenAllowlist + recipientAllowlist + maxAmountWei = 3 violations
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('tokenAllowlist'),
          expect.stringContaining('recipientAllowlist'),
          expect.stringContaining('maxAmountWei'),
        ]),
      );
    });

    it('should allow a valid Aave V3 repay within policy limits', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'repay',
        args: [USDC, 500000000n, 2n, RECIPIENT],
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      expect(intent.protocol).toBe('aave_v3');
      expect(intent.protocol !== 'unknown' && 'action' in intent ? intent.action : '').toBe('repay');

      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should allow a valid Aave V3 withdraw within policy limits', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'withdraw',
        args: [USDC, 500000000n, RECIPIENT],
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      expect(intent.protocol).toBe('aave_v3');
      expect(intent.protocol !== 'unknown' && 'action' in intent ? intent.action : '').toBe('withdraw');

      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should deny Aave V3 withdraw with unauthorized recipient', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'withdraw',
        args: [USDC, 100n, UNAUTHORIZED_ADDR],
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('recipientAllowlist')]),
      );
    });

    it('should deny when Aave V3 intent exists but no evaluator registered (fail-closed)', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [USDC, 100n, RECIPIENT, 0],
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);
      expect(intent.protocol).toBe('aave_v3');

      // No Aave evaluator passed
      const engine = new PolicyEngine(createAavePermissiveConfig(), [erc20Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('No policy evaluator')]),
      );
    });

    it('should deny when evaluator registered but protocolPolicies.aave_v3 missing (fail-closed)', () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [USDC, 100n, RECIPIENT, 0],
      });

      const intent = dispatcher.dispatch(1, AAVE_V3_POOL, data);

      // Config without aave_v3 in protocolPolicies
      const config = createAavePermissiveConfig({
        protocolPolicies: {
          erc20: {
            tokenAllowlist: [USDC.toLowerCase() as Address],
          },
        },
      });
      const engine = new PolicyEngine(config, [erc20Evaluator, aaveV3Evaluator]);
      const result = engine.evaluate({
        chainId: 1,
        to: AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        selector: data.slice(0, 10) as Hex,
        intent,
      });

      expect(result.allowed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('No policy evaluator')]),
      );
    });
  });
});
