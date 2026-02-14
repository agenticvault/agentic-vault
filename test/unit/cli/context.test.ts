import { describe, it, expect, vi } from 'vitest';
import { parseGlobalArgs } from '@/cli/context.js';

// Mock heavy dependencies so buildWorkflowContext / buildDryRunContext can be tested
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

vi.mock('@/agentic/index.js', () => {
  class MockAuditLogger {
    log = vi.fn();
  }
  return { AuditLogger: MockAuditLogger };
});

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({
    allowedChainIds: [1, 137],
    allowedContracts: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
    allowedSelectors: ['0x095ea7b3'],
    maxAmountWei: '1000000000000000000',
    maxDeadlineSeconds: 3600,
    protocolPolicies: {
      erc20: {
        tokenAllowlist: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
        recipientAllowlist: ['0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'],
        maxAllowanceWei: '1000000000000000000',
      },
    },
  })),
}));

describe('parseGlobalArgs', () => {
  it('should parse --key-id and --region', () => {
    const result = parseGlobalArgs(['--key-id', 'abc', '--region', 'us-east-1']);
    expect(result.keyId).toBe('abc');
    expect(result.region).toBe('us-east-1');
  });

  it('should parse optional --expected-address', () => {
    const result = parseGlobalArgs([
      '--key-id', 'abc', '--region', 'us-east-1', '--expected-address', '0x1234',
    ]);
    expect(result.expectedAddress).toBe('0x1234');
  });

  it('should parse optional --policy-config', () => {
    const result = parseGlobalArgs([
      '--key-id', 'abc', '--region', 'us-east-1', '--policy-config', '/tmp/policy.json',
    ]);
    expect(result.policyConfig).toBe('/tmp/policy.json');
  });

  it('should throw when --key-id is missing', () => {
    expect(() => parseGlobalArgs(['--region', 'us-east-1'])).toThrow('--key-id is required');
  });

  it('should throw when --region is missing', () => {
    expect(() => parseGlobalArgs(['--key-id', 'abc'])).toThrow('--region is required');
  });

  it('should ignore unknown flags without error', () => {
    const result = parseGlobalArgs([
      '--key-id', 'abc', '--region', 'us-east-1', '--unknown', 'val',
    ]);
    expect(result.keyId).toBe('abc');
  });
});

describe('buildWorkflowContext', () => {
  it('should return a WorkflowContext with caller=cli', async () => {
    const { buildWorkflowContext } = await import('@/cli/context.js');
    const ctx = buildWorkflowContext({ keyId: 'k', region: 'r' });
    expect(ctx.caller).toBe('cli');
    expect(ctx.service).toBe('agentic-vault-cli');
    expect(ctx.signer).toBeDefined();
    expect(ctx.policyEngine).toBeDefined();
    expect(ctx.auditSink).toBeDefined();
    expect(ctx.dispatcher).toBeDefined();
  });

  it('should load policy from file when policyConfig is provided', async () => {
    const { buildWorkflowContext } = await import('@/cli/context.js');
    const { readFileSync } = await import('node:fs');
    const ctx = buildWorkflowContext({
      keyId: 'k', region: 'r', policyConfig: '/tmp/policy.json',
    });
    expect(readFileSync).toHaveBeenCalledWith('/tmp/policy.json', 'utf-8');
    expect(ctx.policyEngine).toBeDefined();
  });

  it('should use default deny-all policy when no policyConfig', async () => {
    const { buildWorkflowContext } = await import('@/cli/context.js');
    const ctx = buildWorkflowContext({ keyId: 'k', region: 'r' });
    // Default policy has empty arrays — should deny everything
    const evalResult = ctx.policyEngine.evaluate({
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    });
    expect(evalResult.allowed).toBe(false);
  });
});

describe('buildDryRunContext', () => {
  it('should return context with signer=undefined and dryRun=true', async () => {
    const { buildDryRunContext } = await import('@/cli/context.js');
    const ctx = buildDryRunContext();
    expect(ctx.signer).toBeUndefined();
    expect(ctx.dryRun).toBe(true);
    expect(ctx.caller).toBe('cli');
  });

  it('should include dispatcher for decoding', async () => {
    const { buildDryRunContext } = await import('@/cli/context.js');
    const ctx = buildDryRunContext();
    expect(ctx.dispatcher).toBeDefined();
  });

  it('should load policy from file when policyConfig is provided', async () => {
    const { buildDryRunContext } = await import('@/cli/context.js');
    const { readFileSync } = await import('node:fs');
    const ctx = buildDryRunContext({ policyConfig: '/tmp/policy.json' });
    expect(readFileSync).toHaveBeenCalledWith('/tmp/policy.json', 'utf-8');
    expect(ctx.policyEngine).toBeDefined();
  });
});
