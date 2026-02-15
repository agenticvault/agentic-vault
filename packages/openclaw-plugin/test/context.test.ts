import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — must be declared before imports that use them
// ============================================================================

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
      allowedChainIds: [1, 137],
      allowedContracts: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
      allowedSelectors: ['0x095ea7b3'],
      maxAmountWei: 1000000000000000000n,
      maxDeadlineSeconds: 3600,
      protocolPolicies: {
        erc20: {
          tokenAllowlist: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
          recipientAllowlist: ['0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45'],
          maxAllowanceWei: 1000000000000000000n,
        },
      },
    }),
  };
});

// ============================================================================
// Tests
// ============================================================================

describe('buildContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a WorkflowContext with caller=openclaw', async () => {
    const { buildContext } = await import('../src/context.js');
    const ctx = buildContext({ keyId: 'test-key', region: 'us-east-1' });

    expect(ctx.caller).toBe('openclaw');
    expect(ctx.service).toBe('agentic-vault-openclaw');
    expect(ctx.signer).toBeDefined();
    expect(ctx.policyEngine).toBeDefined();
    expect(ctx.auditSink).toBeDefined();
    expect(ctx.dispatcher).toBeDefined();
  });

  it('should create signer with correct config', async () => {
    const { buildContext } = await import('../src/context.js');
    const { createSigningProvider } = await import('@agenticvault/agentic-vault');

    buildContext({ keyId: 'my-key', region: 'eu-west-1', expectedAddress: '0xabc' });

    expect(createSigningProvider).toHaveBeenCalledWith({
      provider: 'aws-kms',
      keyId: 'my-key',
      region: 'eu-west-1',
    });
  });

  it('should return a new instance on every call (no singleton)', async () => {
    const { buildContext } = await import('../src/context.js');
    const config = { keyId: 'test-key', region: 'us-east-1' };

    const ctx1 = buildContext(config);
    const ctx2 = buildContext(config);

    expect(ctx1).not.toBe(ctx2);
  });

  it('should allow different configs across calls', async () => {
    const { buildContext } = await import('../src/context.js');

    const ctx1 = buildContext({ keyId: 'key-1', region: 'us-east-1' });
    const ctx2 = buildContext({ keyId: 'key-2', region: 'eu-west-1' });

    expect(ctx1.caller).toBe('openclaw');
    expect(ctx2.caller).toBe('openclaw');
  });

  it('should throw when keyId is missing', async () => {
    const { buildContext } = await import('../src/context.js');

    expect(() => buildContext({ keyId: '', region: 'us-east-1' })).toThrow(
      'OpenClaw plugin config: keyId is required',
    );
  });

  it('should throw when region is missing', async () => {
    const { buildContext } = await import('../src/context.js');

    expect(() => buildContext({ keyId: 'key', region: '' })).toThrow(
      'OpenClaw plugin config: region is required',
    );
  });

  it('should use deny-all default policy when no policyConfigPath', async () => {
    const { buildContext } = await import('../src/context.js');
    const { loadPolicyConfigFromFile } = await import('@agenticvault/agentic-vault/protocols');
    const ctx = buildContext({ keyId: 'key', region: 'us-east-1' });

    // loadPolicyConfigFromFile should NOT have been called (no policy file)
    expect(loadPolicyConfigFromFile).not.toHaveBeenCalled();
    // The policy engine is initialized (with deny-all default)
    expect(ctx.policyEngine).toBeDefined();
  });

  it('should load policy from file when policyConfigPath is provided', async () => {
    const { buildContext } = await import('../src/context.js');
    const { loadPolicyConfigFromFile } = await import('@agenticvault/agentic-vault/protocols');

    buildContext({ keyId: 'key', region: 'us-east-1', policyConfigPath: '/tmp/policy.json' });

    expect(loadPolicyConfigFromFile).toHaveBeenCalledWith('/tmp/policy.json');
  });

  it('should provide an audit sink that logs to stderr', async () => {
    const { buildContext } = await import('../src/context.js');
    const ctx = buildContext({ keyId: 'key', region: 'us-east-1' });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    ctx.auditSink.log({
      service: 'test',
      action: 'test_action',
      who: 'openclaw',
      what: 'test event',
      why: 'unit test',
      result: 'approved',
    });

    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.service).toBe('test');
    expect(parsed.action).toBe('test_action');
    expect(parsed.who).toBe('openclaw');
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.traceId).toBeDefined();

    stderrSpy.mockRestore();
  });
});
