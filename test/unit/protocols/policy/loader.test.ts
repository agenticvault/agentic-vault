import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

import { parsePolicyConfig, loadPolicyConfigFromFile } from '@/protocols/policy/loader.js';
import { readFileSync } from 'node:fs';

const mockReadFileSync = vi.mocked(readFileSync);

describe('parsePolicyConfig', () => {
  it('should parse V1 config (no protocolPolicies)', () => {
    const config = parsePolicyConfig({
      allowedChainIds: [1, 137],
      allowedContracts: ['0xABC'],
      allowedSelectors: ['0x095EA7B3'],
      maxAmountWei: '1000000000000000000',
      maxDeadlineSeconds: 3600,
    });

    expect(config.allowedChainIds).toEqual([1, 137]);
    expect(config.allowedContracts).toEqual(['0xabc']);
    expect(config.allowedSelectors).toEqual(['0x095ea7b3']);
    expect(config.maxAmountWei).toBe(1000000000000000000n);
    expect(config.maxDeadlineSeconds).toBe(3600);
    expect(config.protocolPolicies).toBeUndefined();
  });

  it('should parse V2 config with protocolPolicies', () => {
    const config = parsePolicyConfig({
      allowedChainIds: [1],
      allowedContracts: [],
      allowedSelectors: [],
      maxAmountWei: '0',
      maxDeadlineSeconds: 0,
      protocolPolicies: {
        erc20: {
          tokenAllowlist: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
          recipientAllowlist: ['0xDEAD000000000000000000000000000000000001'],
          maxAllowanceWei: '500000000000000000000',
        },
      },
    });

    expect(config.protocolPolicies).toBeDefined();
    const erc20 = config.protocolPolicies!.erc20;
    expect(erc20.tokenAllowlist).toEqual([
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    ]);
    expect(erc20.recipientAllowlist).toEqual([
      '0xdead000000000000000000000000000000000001',
    ]);
    expect(erc20.maxAllowanceWei).toBe(500000000000000000000n);
  });

  it('should lowercase tokenAllowlist and recipientAllowlist', () => {
    const config = parsePolicyConfig({
      allowedChainIds: [],
      maxAmountWei: '0',
      protocolPolicies: {
        erc20: {
          tokenAllowlist: ['0xABC', '0xDEF'],
          recipientAllowlist: ['0x123ABC'],
        },
      },
    });
    const erc20 = config.protocolPolicies!.erc20;

    expect(erc20.tokenAllowlist).toEqual(['0xabc', '0xdef']);
    expect(erc20.recipientAllowlist).toEqual(['0x123abc']);
  });

  it('should handle maxAllowanceWei as BigInt', () => {
    const config = parsePolicyConfig({
      maxAmountWei: '0',
      protocolPolicies: {
        erc20: {
          maxAllowanceWei: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        },
      },
    });
    const erc20 = config.protocolPolicies!.erc20;

    expect(typeof erc20.maxAllowanceWei).toBe('bigint');
    expect(erc20.maxAllowanceWei).toBe(
      115792089237316195423570985008687907853269984665640564039457584007913129639935n,
    );
  });

  it('should handle missing optional protocolPolicies fields', () => {
    const config = parsePolicyConfig({
      maxAmountWei: '0',
      protocolPolicies: {
        erc20: {
          maxSlippageBps: 50,
        },
      },
    });
    const erc20 = config.protocolPolicies!.erc20;

    expect(erc20.tokenAllowlist).toBeUndefined();
    expect(erc20.recipientAllowlist).toBeUndefined();
    expect(erc20.maxAllowanceWei).toBeUndefined();
    expect(erc20.maxSlippageBps).toBe(50);
  });

  it('should default missing fields', () => {
    const config = parsePolicyConfig({});

    expect(config.allowedChainIds).toEqual([]);
    expect(config.allowedContracts).toEqual([]);
    expect(config.allowedSelectors).toEqual([]);
    expect(config.maxAmountWei).toBe(0n);
    expect(config.maxDeadlineSeconds).toBe(0);
    expect(config.protocolPolicies).toBeUndefined();
  });

  it('should handle Aave V3 protocol policies', () => {
    const config = parsePolicyConfig({
      maxAmountWei: '0',
      protocolPolicies: {
        aave_v3: {
          tokenAllowlist: ['0xC02AAA39B223FE8D0A0E5C4F27EAD9083C756CC2'],
          maxInterestRateMode: 2,
          maxAmountWei: '1000000000000000000',
          recipientAllowlist: [],
        },
      },
    });
    const aave = config.protocolPolicies!.aave_v3;

    expect(aave.tokenAllowlist).toEqual(['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2']);
    expect(aave.maxInterestRateMode).toBe(2);
    expect(aave.maxAmountWei).toBe(1000000000000000000n);
    expect(aave.recipientAllowlist).toEqual([]);
  });
});

describe('loadPolicyConfigFromFile', () => {
  it('should read file and parse', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      allowedChainIds: [1],
      allowedContracts: ['0xabc'],
      allowedSelectors: [],
      maxAmountWei: '100',
      maxDeadlineSeconds: 60,
    }));

    const config = loadPolicyConfigFromFile('/tmp/policy.json');

    expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/policy.json', 'utf-8');
    expect(config.allowedChainIds).toEqual([1]);
    expect(config.maxAmountWei).toBe(100n);
  });
});
