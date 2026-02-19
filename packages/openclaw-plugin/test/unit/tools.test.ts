import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type OpenClawPluginConfig } from '../../src/types.js';
import { type WorkflowContext } from '@agenticvault/agentic-vault/protocols';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@agenticvault/agentic-vault/protocols', () => ({
  signDefiCall: vi.fn().mockResolvedValue({ status: 'approved', data: '0xsigned-defi' }),
  signPermit: vi.fn().mockResolvedValue({ status: 'approved', data: '{"v":27,"r":"0xabc","s":"0xdef"}' }),
  getAddressWorkflow: vi.fn().mockResolvedValue({ status: 'approved', data: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }),
  healthCheckWorkflow: vi.fn().mockResolvedValue({ status: 'approved', data: '{"status":"healthy"}' }),
  getBalanceWorkflow: vi.fn().mockResolvedValue({ status: 'approved', data: '{"balance":"1000000000000000000","symbol":"ETH"}' }),
  sendTransfer: vi.fn().mockResolvedValue({ status: 'approved', data: '{"txHash":"0xabc123","explorerUrl":"https://etherscan.io/tx/0xabc123"}' }),
  sendErc20Transfer: vi.fn().mockResolvedValue({ status: 'approved', data: '{"txHash":"0xdef456","explorerUrl":"https://etherscan.io/tx/0xdef456"}' }),
}));

// ============================================================================
// Helpers
// ============================================================================

interface RegisteredTool {
  tool: { name: string; description: string; label: string; parameters: unknown; execute: (toolCallId: string, params: Record<string, unknown>) => Promise<{ content: { type: 'text'; text: string }[]; details: undefined }> };
  opts?: { optional?: boolean };
}

function createMockApi() {
  const tools = new Map<string, RegisteredTool>();
  return {
    pluginConfig: undefined as Record<string, unknown> | undefined,
    tools,
    registerTool(tool: RegisteredTool['tool'], opts?: RegisteredTool['opts']) {
      tools.set(tool.name, { tool, opts });
    },
  };
}

function createMockContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8...signedtx'),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditSink: { log: vi.fn() },
    dispatcher: {
      dispatch: vi.fn().mockReturnValue({
        protocol: 'erc20',
        chainId: 1,
        to: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        action: 'approve',
      }),
    },
    caller: 'openclaw',
    service: 'agentic-vault-openclaw',
    ...overrides,
  };
}

const SAFE_CONFIG: OpenClawPluginConfig = {
  keyId: 'test-key',
  region: 'us-east-1',
  enableUnsafeRawSign: false,
};

const UNSAFE_CONFIG: OpenClawPluginConfig = {
  keyId: 'test-key',
  region: 'us-east-1',
  enableUnsafeRawSign: true,
};

// ============================================================================
// Tests
// ============================================================================

describe('registerTools', () => {
  let api: ReturnType<typeof createMockApi>;
  let ctx: WorkflowContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    api = createMockApi();
    ctx = createMockContext();
  });

  describe('tool registration', () => {
    it('should register 7 safe tools when enableUnsafeRawSign is false', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      expect(api.tools.size).toBe(7);
      expect(api.tools.has('vault_get_address')).toBe(true);
      expect(api.tools.has('vault_health_check')).toBe(true);
      expect(api.tools.has('vault_sign_defi_call')).toBe(true);
      expect(api.tools.has('vault_sign_permit')).toBe(true);
      expect(api.tools.has('vault_get_balance')).toBe(true);
      expect(api.tools.has('vault_send_transfer')).toBe(true);
      expect(api.tools.has('vault_send_erc20_transfer')).toBe(true);
    });

    it('should register 9 tools when enableUnsafeRawSign is true', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, UNSAFE_CONFIG);

      expect(api.tools.size).toBe(9);
      expect(api.tools.has('vault_sign_transaction')).toBe(true);
      expect(api.tools.has('vault_sign_typed_data')).toBe(true);
    });

    it('should NOT register dual-gated tools without enableUnsafeRawSign', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      expect(api.tools.has('vault_sign_transaction')).toBe(false);
      expect(api.tools.has('vault_sign_typed_data')).toBe(false);
    });

    it('should mark dual-gated tools as optional', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, UNSAFE_CONFIG);

      expect(api.tools.get('vault_sign_transaction')!.opts?.optional).toBe(true);
      expect(api.tools.get('vault_sign_typed_data')!.opts?.optional).toBe(true);
    });

    it('should NOT mark safe tools as optional', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      for (const [, entry] of api.tools) {
        expect(entry.opts?.optional).toBeUndefined();
      }
    });

    it('should include label on every tool', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, UNSAFE_CONFIG);

      for (const [, entry] of api.tools) {
        expect(typeof entry.tool.label).toBe('string');
        expect(entry.tool.label.length).toBeGreaterThan(0);
      }
    });

    it('should use JSON Schema object format for parameters', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      for (const [, entry] of api.tools) {
        const params = entry.tool.parameters as { type: string; properties: unknown; required: unknown[] };
        expect(params.type).toBe('object');
        expect(params.properties).toBeDefined();
        expect(Array.isArray(params.required)).toBe(true);
      }
    });
  });

  describe('vault_get_address', () => {
    it('should call getAddressWorkflow and return result', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { getAddressWorkflow } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const result = await api.tools.get('vault_get_address')!.tool.execute('test-id', {});

      expect(getAddressWorkflow).toHaveBeenCalledWith(ctx);
      expect(result.content[0].text).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });
  });

  describe('vault_health_check', () => {
    it('should call healthCheckWorkflow and return result', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { healthCheckWorkflow } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const result = await api.tools.get('vault_health_check')!.tool.execute('test-id', {});

      expect(healthCheckWorkflow).toHaveBeenCalledWith(ctx);
      expect(result.content[0].text).toBe('{"status":"healthy"}');
    });
  });

  describe('vault_sign_defi_call', () => {
    it('should call signDefiCall workflow with correct args', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { signDefiCall } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const args = {
        chainId: 1,
        to: '0x1234567890123456789012345678901234567890',
        data: '0x095ea7b3',
      };
      const result = await api.tools.get('vault_sign_defi_call')!.tool.execute('test-id', args);

      expect(signDefiCall).toHaveBeenCalledWith(ctx, 'vault_sign_defi_call', {
        chainId: 1,
        to: '0x1234567890123456789012345678901234567890',
        data: '0x095ea7b3',
        value: undefined,
      });
      expect(result.content[0].text).toBe('0xsigned-defi');
    });
  });

  describe('vault_sign_permit', () => {
    it('should call signPermit workflow with correct args', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { signPermit } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const args = {
        chainId: 1,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        value: '1000000',
        deadline: 1700000000,
        domain: { name: 'USDC', chainId: 1, verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        types: { Permit: [{ name: 'owner', type: 'address' }] },
        message: { owner: '0xabc', value: '1000000', spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', deadline: 1700000000 },
      };
      const result = await api.tools.get('vault_sign_permit')!.tool.execute('test-id', args);

      expect(signPermit).toHaveBeenCalledWith(ctx, {
        chainId: 1,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        value: '1000000',
        deadline: 1700000000,
        domain: args.domain,
        types: args.types,
        message: args.message,
      });
      expect(result.content[0].text).toBe('{"v":27,"r":"0xabc","s":"0xdef"}');
    });
  });

  describe('toResult adapter — denied/error/dry-run paths', () => {
    it('should return denied reason when workflow result is denied', async () => {
      const { getAddressWorkflow } = await import('@agenticvault/agentic-vault/protocols');
      vi.mocked(getAddressWorkflow).mockResolvedValueOnce({
        status: 'denied',
        reason: 'Policy denied: chain not allowed',
        violations: ['chain not allowed'],
      });
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const result = await api.tools.get('vault_get_address')!.tool.execute('test-id', {});

      expect(result.content[0].text).toBe('Policy denied: chain not allowed');
    });

    it('should return error message when workflow result is error', async () => {
      const { healthCheckWorkflow } = await import('@agenticvault/agentic-vault/protocols');
      vi.mocked(healthCheckWorkflow).mockResolvedValueOnce({
        status: 'error',
        reason: 'Signer is required for health_check',
      });
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const result = await api.tools.get('vault_health_check')!.tool.execute('test-id', {});

      expect(result.content[0].text).toBe('Error: Signer is required for health_check');
    });

    it('should return dry-run details when workflow result is dry-run-approved', async () => {
      const { signDefiCall } = await import('@agenticvault/agentic-vault/protocols');
      vi.mocked(signDefiCall).mockResolvedValueOnce({
        status: 'dry-run-approved',
        details: { protocol: 'erc20', action: 'approve', chainId: 1, to: '0xabc' },
      });
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const args = { chainId: 1, to: '0xabc', data: '0x095ea7b3' };
      const result = await api.tools.get('vault_sign_defi_call')!.tool.execute('test-id', args);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.protocol).toBe('erc20');
      expect(parsed.action).toBe('approve');
    });
  });

  describe('vault_sign_transaction (dual-gated)', () => {
    it('should sign raw transaction and audit log', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, UNSAFE_CONFIG);

      const args = {
        chainId: 1,
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
      };
      const result = await api.tools.get('vault_sign_transaction')!.tool.execute('test-id', args);

      expect(ctx.signer!.signTransaction).toHaveBeenCalled();
      expect(ctx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vault_sign_transaction',
          who: 'openclaw',
          result: 'approved',
        }),
      );
      expect(result.content[0].text).toBe('0x02f8...signedtx');
    });

    it('should return error when signer throws', async () => {
      const errorCtx = createMockContext({
        signer: {
          getAddress: vi.fn(),
          signTransaction: vi.fn().mockRejectedValue(new Error('KMS unavailable')),
          signTypedData: vi.fn(),
          healthCheck: vi.fn(),
        },
      });
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, errorCtx, UNSAFE_CONFIG);

      const args = { chainId: 1, to: '0x1234567890123456789012345678901234567890' };
      const result = await api.tools.get('vault_sign_transaction')!.tool.execute('test-id', args);

      expect(result.content[0].text).toContain('Signing error: KMS unavailable');
      expect(errorCtx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'error' }),
      );
    });

    it('should return error when signer is not available', async () => {
      const noSignerCtx = createMockContext({ signer: undefined });
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, noSignerCtx, UNSAFE_CONFIG);

      const args = { chainId: 1, to: '0x1234567890123456789012345678901234567890' };
      const result = await api.tools.get('vault_sign_transaction')!.tool.execute('test-id', args);

      expect(result.content[0].text).toBe('Error: Signer is not available');
      expect(noSignerCtx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'vault_sign_transaction', result: 'error' }),
      );
    });
  });

  describe('vault_sign_typed_data (dual-gated)', () => {
    it('should sign typed data and audit log', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, UNSAFE_CONFIG);

      const args = {
        domain: { name: 'Test' },
        types: { Test: [{ name: 'val', type: 'uint256' }] },
        primaryType: 'Test',
        message: { val: 42 },
      };
      const result = await api.tools.get('vault_sign_typed_data')!.tool.execute('test-id', args);

      expect(ctx.signer!.signTypedData).toHaveBeenCalledWith({
        domain: args.domain,
        types: args.types,
        primaryType: 'Test',
        message: args.message,
      });
      expect(ctx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vault_sign_typed_data',
          who: 'openclaw',
          result: 'approved',
        }),
      );
      expect(result.content[0].type).toBe('text');
    });

    it('should return error when signer throws', async () => {
      const errorCtx = createMockContext({
        signer: {
          getAddress: vi.fn(),
          signTransaction: vi.fn(),
          signTypedData: vi.fn().mockRejectedValue(new Error('Sign failed')),
          healthCheck: vi.fn(),
        },
      });
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, errorCtx, UNSAFE_CONFIG);

      const args = {
        domain: {},
        types: {},
        primaryType: 'Test',
        message: {},
      };
      const result = await api.tools.get('vault_sign_typed_data')!.tool.execute('test-id', args);

      expect(result.content[0].text).toContain('Signing error: Sign failed');
    });
  });

  describe('vault_get_balance', () => {
    it('should call getBalanceWorkflow and return result', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { getBalanceWorkflow } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const args = { chainId: 1 };
      const result = await api.tools.get('vault_get_balance')!.tool.execute('test-id', args);

      expect(getBalanceWorkflow).toHaveBeenCalledWith(ctx, {
        chainId: 1,
        address: undefined,
        token: undefined,
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.balance).toBe('1000000000000000000');
    });
  });

  describe('vault_send_transfer', () => {
    it('should call sendTransfer workflow with correct args', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { sendTransfer } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const args = {
        chainId: 1,
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
      };
      const result = await api.tools.get('vault_send_transfer')!.tool.execute('test-id', args);

      expect(sendTransfer).toHaveBeenCalledWith(ctx, {
        chainId: 1,
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.txHash).toBe('0xabc123');
    });
  });

  describe('vault_send_erc20_transfer', () => {
    it('should call sendErc20Transfer workflow with correct args', async () => {
      const { registerTools } = await import('../../src/tools.js');
      const { sendErc20Transfer } = await import('@agenticvault/agentic-vault/protocols');
      registerTools(api as never, ctx, SAFE_CONFIG);

      const args = {
        chainId: 1,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000',
      };
      const result = await api.tools.get('vault_send_erc20_transfer')!.tool.execute('test-id', args);

      expect(sendErc20Transfer).toHaveBeenCalledWith(ctx, {
        chainId: 1,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000',
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.txHash).toBe('0xdef456');
    });
  });

  describe('response format', () => {
    it('should return { content: [{ type: "text", text }] } for all tools', async () => {
      const { registerTools } = await import('../../src/tools.js');
      registerTools(api as never, ctx, UNSAFE_CONFIG);

      for (const [, entry] of api.tools) {
        const result = await entry.tool.execute('test-id', {
          chainId: 1,
          to: '0x1234567890123456789012345678901234567890',
          data: '0x095ea7b3',
          domain: { name: 'Test', chainId: 1, verifyingContract: '0x1234567890123456789012345678901234567890' },
          types: { Test: [{ name: 'val', type: 'uint256' }] },
          primaryType: 'Test',
          message: { val: 42 },
          token: '0x1234567890123456789012345678901234567890',
          spender: '0x1234567890123456789012345678901234567890',
          value: '1000',
          amount: '1000',
          deadline: 1700000000,
        });

        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThanOrEqual(1);
        expect(result.content[0].type).toBe('text');
        expect(typeof result.content[0].text).toBe('string');
      }
    });
  });
});
