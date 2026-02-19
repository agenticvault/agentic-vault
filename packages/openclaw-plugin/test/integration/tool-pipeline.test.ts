import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type OpenClawPluginConfig } from '../../src/types.js';

// Mock the host package
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

interface RegisteredTool {
  tool: { name: string; execute: (toolCallId: string, params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }> };
  opts?: { optional?: boolean };
}

function createMockApi(config?: OpenClawPluginConfig) {
  const tools = new Map<string, RegisteredTool>();
  return {
    pluginConfig: config as Record<string, unknown> | undefined,
    tools,
    registerTool(tool: RegisteredTool['tool'], opts?: RegisteredTool['opts']) {
      tools.set(tool.name, { tool, opts });
    },
  };
}

describe('tool-pipeline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('vault_get_address should return address via full register path', async () => {
    const mod = await import('../../src/index.js');
    const api = createMockApi({ keyId: 'test-key', region: 'us-east-1' });

    mod.default(api as never);

    const tool = api.tools.get('vault_get_address')!.tool;
    const result = await tool.execute('test-id', {});

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });

  it('vault_health_check should return health status via full register path', async () => {
    const mod = await import('../../src/index.js');
    const api = createMockApi({ keyId: 'test-key', region: 'us-east-1' });

    mod.default(api as never);

    const tool = api.tools.get('vault_health_check')!.tool;
    const result = await tool.execute('test-id', {});

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('healthy');
  });

  it('vault_sign_defi_call should return signed data via full register path', async () => {
    const mod = await import('../../src/index.js');
    const api = createMockApi({ keyId: 'test-key', region: 'us-east-1' });

    mod.default(api as never);

    const tool = api.tools.get('vault_sign_defi_call')!.tool;
    const result = await tool.execute('test-id', {
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      data: '0x095ea7b3',
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('0xsigned');
  });

  it('vault_sign_permit should return signature via full register path', async () => {
    const mod = await import('../../src/index.js');
    const api = createMockApi({ keyId: 'test-key', region: 'us-east-1' });

    mod.default(api as never);

    const tool = api.tools.get('vault_sign_permit')!.tool;
    const result = await tool.execute('test-id', {
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      value: '1000000',
      deadline: 1700000000,
      domain: { name: 'USDC', chainId: 1, verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      types: { Permit: [{ name: 'owner', type: 'address' }] },
      message: { owner: '0xabc', value: '1000000', spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', deadline: 1700000000 },
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('{"v":27,"r":"0xabc","s":"0xdef"}');
  });
});
