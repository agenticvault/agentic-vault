import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type OpenClawPluginApi, type OpenClawToolConfig, type OpenClawToolHandler } from '../../src/types.js';

// Mock the host package (same pattern as unit tests)
vi.mock('@agenticvault/agentic-vault', () => {
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

vi.mock('@agenticvault/agentic-vault/protocols', () => {
  class MockPolicyEngine {
    evaluate = vi.fn().mockReturnValue({ allowed: false, violations: ['denied by default'] });
  }
  class MockProtocolDispatcher {
    dispatch = vi.fn();
  }
  return {
    PolicyEngine: MockPolicyEngine,
    ProtocolDispatcher: MockProtocolDispatcher,
    createDefaultRegistry: vi.fn().mockReturnValue({}),
    erc20Evaluator: { protocol: 'erc20' },
    uniswapV3Evaluator: { protocol: 'uniswap-v3' },
    aaveV3Evaluator: { protocol: 'aave-v3' },
    loadPolicyConfigFromFile: vi.fn().mockReturnValue({
      allowedChainIds: [1],
      allowedContracts: [],
      allowedSelectors: [],
      maxAmountWei: 0n,
      maxDeadlineSeconds: 0,
      protocolPolicies: {},
    }),
    signDefiCall: vi.fn().mockResolvedValue({ status: 'approved', data: '0xsigned' }),
    signPermit: vi.fn().mockResolvedValue({ status: 'approved', data: '{"v":27,"r":"0xabc","s":"0xdef"}' }),
    getAddressWorkflow: vi.fn().mockResolvedValue({ status: 'approved', data: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }),
    healthCheckWorkflow: vi.fn().mockResolvedValue({ status: 'approved', data: '{"status":"healthy"}' }),
  };
});

// Helper
interface RegisteredTool {
  config: OpenClawToolConfig;
  handler: OpenClawToolHandler;
}

function createMockApi(): OpenClawPluginApi & { tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();
  return {
    tools,
    registerTool(name: string, config: OpenClawToolConfig, handler: OpenClawToolHandler) {
      tools.set(name, { config, handler });
    },
  };
}

describe('plugin-load integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register 4 safe tools via full entry point', async () => {
    const { register } = await import('../../src/index.js');
    const api = createMockApi();

    register(api, { keyId: 'test-key', region: 'us-east-1' });

    expect(api.tools.size).toBe(4);
    expect(api.tools.has('vault_get_address')).toBe(true);
    expect(api.tools.has('vault_health_check')).toBe(true);
    expect(api.tools.has('vault_sign_defi_call')).toBe(true);
    expect(api.tools.has('vault_sign_permit')).toBe(true);
  });

  it('should register 6 tools when enableUnsafeRawSign is true', async () => {
    const { register } = await import('../../src/index.js');
    const api = createMockApi();

    register(api, { keyId: 'test-key', region: 'us-east-1', enableUnsafeRawSign: true });

    expect(api.tools.size).toBe(6);
    expect(api.tools.has('vault_sign_transaction')).toBe(true);
    expect(api.tools.has('vault_sign_typed_data')).toBe(true);
  });

  it('should throw when keyId is empty', async () => {
    const { register } = await import('../../src/index.js');
    const api = createMockApi();

    expect(() => register(api, { keyId: '', region: 'us-east-1' })).toThrow('keyId is required');
  });
});
