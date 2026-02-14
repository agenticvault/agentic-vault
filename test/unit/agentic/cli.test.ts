import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ============================================================================
// Patch process.argv BEFORE module load (hoisted phase) so main() doesn't throw
// ============================================================================

const { originalArgv } = vi.hoisted(() => {
  const orig = process.argv;
  process.argv = ['node', 'cli.js', '--key-id', 'test-key', '--region', 'us-east-1'];
  return { originalArgv: orig };
});

// ============================================================================
// Mock all imports that main() depends on (to prevent side effects on import)
// ============================================================================

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock the provider factory + signer to prevent main() from calling AWS
vi.mock('@/index.js', () => ({
  createSigningProvider: vi.fn().mockReturnValue({}),
  EvmSignerAdapter: class MockEvmSignerAdapter {},
}));

// Mock protocols to prevent main() from instantiating real engines
vi.mock('@/protocols/index.js', () => ({
  PolicyEngine: class MockPolicyEngine {
    evaluate = vi.fn().mockReturnValue({ allowed: true, violations: [] });
  },
  erc20Evaluator: { protocol: 'erc20', supportedSelectors: [], evaluate: vi.fn() },
  uniswapV3Evaluator: { protocol: 'uniswap_v3', evaluate: vi.fn() },
}));

// Mock audit logger
vi.mock('@/agentic/audit/logger.js', () => ({
  AuditLogger: class MockAuditLogger {
    log = vi.fn();
  },
}));

// Mock server startup to prevent stdio transport issues
vi.mock('@/agentic/mcp/server.js', () => ({
  startStdioServer: vi.fn().mockResolvedValue(undefined),
}));

import { parseArgs, loadPolicyConfig } from '@/agentic/cli.js';
import { readFileSync } from 'node:fs';

const mockReadFileSync = vi.mocked(readFileSync);

// ============================================================================
// Tests
// ============================================================================

describe('CLI utilities', () => {
  afterAll(() => {
    process.argv = originalArgv;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseArgs', () => {
    it('should parse all flags', () => {
      const argv = [
        'node', 'cli.js',
        '--key-id', 'alias/my-key',
        '--region', 'us-east-1',
        '--expected-address', '0xabc',
        '--unsafe-raw-sign',
        '--policy-config', '/path/to/policy.json',
      ];

      const result = parseArgs(argv);

      expect(result).toEqual({
        keyId: 'alias/my-key',
        region: 'us-east-1',
        expectedAddress: '0xabc',
        unsafeRawSign: true,
        policyConfig: '/path/to/policy.json',
      });
    });

    it('should parse minimal valid args', () => {
      const argv = ['node', 'cli.js', '--key-id', 'k1', '--region', 'eu-west-1'];

      const result = parseArgs(argv);

      expect(result).toEqual({
        keyId: 'k1',
        region: 'eu-west-1',
        expectedAddress: undefined,
        unsafeRawSign: false,
        policyConfig: undefined,
      });
    });

    it('should throw when --key-id is missing', () => {
      const argv = ['node', 'cli.js', '--region', 'us-east-1'];

      expect(() => parseArgs(argv)).toThrow('--key-id is required');
    });

    it('should throw when --region is missing', () => {
      const argv = ['node', 'cli.js', '--key-id', 'k1'];

      expect(() => parseArgs(argv)).toThrow('--region is required');
    });

    it('should set unsafeRawSign when flag is present', () => {
      const argv = [
        'node', 'cli.js',
        '--key-id', 'k1',
        '--region', 'r1',
        '--unsafe-raw-sign',
      ];

      expect(parseArgs(argv).unsafeRawSign).toBe(true);
    });

    it('should default unsafeRawSign to false', () => {
      const argv = ['node', 'cli.js', '--key-id', 'k1', '--region', 'r1'];

      expect(parseArgs(argv).unsafeRawSign).toBe(false);
    });

    it('should ignore unknown arguments', () => {
      const argv = [
        'node', 'cli.js',
        '--key-id', 'k1',
        '--region', 'r1',
        '--unknown-flag',
        '--another',
        'value',
      ];

      const result = parseArgs(argv);
      expect(result.keyId).toBe('k1');
      expect(result.region).toBe('r1');
    });
  });

  describe('loadPolicyConfig', () => {
    it('should parse V1 config (no protocolPolicies)', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        allowedChainIds: [1, 137],
        allowedContracts: ['0xABC'],
        allowedSelectors: ['0x095EA7B3'],
        maxAmountWei: '1000000000000000000',
        maxDeadlineSeconds: 3600,
      }));

      const config = loadPolicyConfig('/fake/path.json');

      expect(config.allowedChainIds).toEqual([1, 137]);
      expect(config.allowedContracts).toEqual(['0xabc']);
      expect(config.allowedSelectors).toEqual(['0x095ea7b3']);
      expect(config.maxAmountWei).toBe(1000000000000000000n);
      expect(config.maxDeadlineSeconds).toBe(3600);
      expect(config.protocolPolicies).toBeUndefined();
    });

    it('should parse V2 config with protocolPolicies', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
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
      }));

      const config = loadPolicyConfig('/fake/path.json');

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
      mockReadFileSync.mockReturnValue(JSON.stringify({
        allowedChainIds: [],
        maxAmountWei: '0',
        protocolPolicies: {
          erc20: {
            tokenAllowlist: ['0xABC', '0xDEF'],
            recipientAllowlist: ['0x123ABC'],
          },
        },
      }));

      const config = loadPolicyConfig('/fake/path.json');
      const erc20 = config.protocolPolicies!.erc20;

      expect(erc20.tokenAllowlist).toEqual(['0xabc', '0xdef']);
      expect(erc20.recipientAllowlist).toEqual(['0x123abc']);
    });

    it('should handle maxAllowanceWei as BigInt', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        maxAmountWei: '0',
        protocolPolicies: {
          erc20: {
            maxAllowanceWei: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          },
        },
      }));

      const config = loadPolicyConfig('/fake/path.json');
      const erc20 = config.protocolPolicies!.erc20;

      expect(typeof erc20.maxAllowanceWei).toBe('bigint');
      expect(erc20.maxAllowanceWei).toBe(
        115792089237316195423570985008687907853269984665640564039457584007913129639935n,
      );
    });

    it('should handle missing optional protocolPolicies fields', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
        maxAmountWei: '0',
        protocolPolicies: {
          erc20: {
            maxSlippageBps: 50,
          },
        },
      }));

      const config = loadPolicyConfig('/fake/path.json');
      const erc20 = config.protocolPolicies!.erc20;

      expect(erc20.tokenAllowlist).toBeUndefined();
      expect(erc20.recipientAllowlist).toBeUndefined();
      expect(erc20.maxAllowanceWei).toBeUndefined();
      expect(erc20.maxSlippageBps).toBe(50);
    });
  });
});
