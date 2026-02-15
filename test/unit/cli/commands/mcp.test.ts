import { describe, it, expect, vi, afterEach } from 'vitest';

// Use vi.hoisted to create mock references accessible inside vi.mock factories
const { mockStartStdioServer } = vi.hoisted(() => ({
  mockStartStdioServer: vi.fn().mockResolvedValue(undefined),
}));

// Mock external dependencies before import
vi.mock('@/index.js', () => {
  class MockEvmSignerAdapter {
    getAddress = vi.fn();
    signTransaction = vi.fn();
    signTypedData = vi.fn();
    healthCheck = vi.fn();
  }
  return {
    createSigningProvider: vi.fn().mockReturnValue({}),
    EvmSignerAdapter: MockEvmSignerAdapter,
  };
});

vi.mock('@/protocols/index.js', () => {
  class MockPolicyEngine {
    evaluate = vi.fn().mockReturnValue({ allowed: true, violations: [] });
  }
  return {
    PolicyEngine: MockPolicyEngine,
    erc20Evaluator: { protocol: 'erc20', evaluate: vi.fn() },
    uniswapV3Evaluator: { protocol: 'uniswap_v3', evaluate: vi.fn() },
    aaveV3Evaluator: { protocol: 'aave_v3', evaluate: vi.fn() },
    loadPolicyConfigFromFile: vi.fn().mockReturnValue({
      allowedChainIds: [1],
      allowedContracts: [],
      allowedSelectors: [],
      maxAmountWei: 1000000000000000000n,
      maxDeadlineSeconds: 3600,
    }),
  };
});

vi.mock('@/agentic/index.js', () => {
  class MockAuditLogger {
    log = vi.fn();
  }
  return {
    AuditLogger: MockAuditLogger,
    startStdioServer: mockStartStdioServer,
  };
});

import { runMcp } from '@/cli/commands/mcp.js';
import { loadPolicyConfigFromFile } from '@/protocols/index.js';

const mockLoadPolicyConfigFromFile = vi.mocked(loadPolicyConfigFromFile);

describe('runMcp CLI command', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call startStdioServer with unsafeRawSign=false by default', async () => {
    await runMcp({ keyId: 'k', region: 'r' }, []);
    expect(mockStartStdioServer).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeRawSign: false }),
    );
  });

  it('should pass unsafeRawSign=true when --unsafe-raw-sign flag is present', async () => {
    await runMcp({ keyId: 'k', region: 'r' }, ['--unsafe-raw-sign']);
    expect(mockStartStdioServer).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeRawSign: true }),
    );
  });

  it('should load policy config from file when policyConfig is provided', async () => {
    await runMcp({ keyId: 'k', region: 'r', policyConfig: '/tmp/policy.json' }, []);
    expect(mockLoadPolicyConfigFromFile).toHaveBeenCalledWith('/tmp/policy.json');
    expect(mockStartStdioServer).toHaveBeenCalled();
  });

  it('should use default deny-all policy when no policyConfig', async () => {
    await runMcp({ keyId: 'k', region: 'r' }, []);
    expect(mockStartStdioServer).toHaveBeenCalled();
  });
});
