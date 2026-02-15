import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

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
  aaveV3Evaluator: { protocol: 'aave_v3', evaluate: vi.fn() },
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

import { parseArgs } from '@/agentic/cli.js';

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

  describe('environment variable fallback', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });
    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use VAULT_KEY_ID when --key-id not provided', () => {
      process.env.VAULT_KEY_ID = 'env-key-id';
      const argv = ['node', 'cli.js', '--region', 'us-east-1'];

      const result = parseArgs(argv);
      expect(result.keyId).toBe('env-key-id');
    });

    it('should use VAULT_REGION when --region not provided', () => {
      process.env.VAULT_REGION = 'eu-west-1';
      const argv = ['node', 'cli.js', '--key-id', 'k1'];

      const result = parseArgs(argv);
      expect(result.region).toBe('eu-west-1');
    });

    it('should prefer --key-id flag over VAULT_KEY_ID env var', () => {
      process.env.VAULT_KEY_ID = 'env-key-id';
      const argv = ['node', 'cli.js', '--key-id', 'flag-key-id', '--region', 'us-east-1'];

      const result = parseArgs(argv);
      expect(result.keyId).toBe('flag-key-id');
    });

    it('should prefer --region flag over VAULT_REGION env var', () => {
      process.env.VAULT_REGION = 'env-region';
      const argv = ['node', 'cli.js', '--key-id', 'k1', '--region', 'flag-region'];

      const result = parseArgs(argv);
      expect(result.region).toBe('flag-region');
    });

    it('should throw when neither --key-id flag nor VAULT_KEY_ID env var present', () => {
      delete process.env.VAULT_KEY_ID;
      const argv = ['node', 'cli.js', '--region', 'us-east-1'];

      expect(() => parseArgs(argv)).toThrow('--key-id or VAULT_KEY_ID environment variable is required');
    });

    it('should throw when neither --region flag nor VAULT_REGION env var present', () => {
      delete process.env.VAULT_REGION;
      const argv = ['node', 'cli.js', '--key-id', 'k1'];

      expect(() => parseArgs(argv)).toThrow('--region or VAULT_REGION environment variable is required');
    });
  });

});
