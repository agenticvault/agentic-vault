import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSignDefiCall } from '@/agentic/mcp/tools/sign-defi-call.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

// ============================================================================
// Helpers
// ============================================================================

function createMockDispatcher(protocol = 'erc20', action = 'approve') {
  return {
    dispatch: vi.fn().mockReturnValue({
      protocol,
      action,
      chainId: 1,
      to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      selector: '0x095ea7b3',
      args: { spender: '0x1111111111111111111111111111111111111111', amount: 100n },
    }),
  };
}

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8signed'),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditLogger: {
      log: vi.fn(),
    },
    dispatcher: createMockDispatcher(),
    ...overrides,
  };
}

 
function getToolHandler(server: McpServer, toolName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { handler: (args: Record<string, unknown>) => Promise<any> }
  >;
  return tools[toolName].handler;
}

// ============================================================================
// Tests
// ============================================================================

describe('sign_defi_call tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (args: Record<string, unknown>) => Promise<any>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSignDefiCall(server, ctx);
    handler = getToolHandler(server, 'sign_defi_call');
  });

  it('should register the sign_defi_call tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  describe('dispatcher requirement', () => {
    it('should throw when dispatcher is missing', async () => {
      ctx = createMockContext({ dispatcher: undefined });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignDefiCall(server, ctx);
      handler = getToolHandler(server, 'sign_defi_call');

      await expect(handler({
        chainId: 1,
        to: '0x1234',
        data: '0x095ea7b3',
      })).rejects.toThrow('sign_defi_call requires dispatcher in WorkflowContext');
    });

    it('should call dispatcher.dispatch with correct args', async () => {
      await handler({
        chainId: 1,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x095ea7b300000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000064',
      });

      expect(ctx.dispatcher!.dispatch).toHaveBeenCalledWith(
        1,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0x095ea7b300000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000064',
      );
    });
  });

  describe('unknown protocol rejection', () => {
    it('should reject unknown protocols with fail-closed semantics', async () => {
      ctx = createMockContext({
        dispatcher: {
          dispatch: vi.fn().mockReturnValue({
            protocol: 'unknown',
            chainId: 1,
            to: '0x1234',
            rawData: '0xdeadbeef',
            reason: 'No registered decoder for contract 0x1234 on chain 1',
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignDefiCall(server, ctx);
      handler = getToolHandler(server, 'sign_defi_call');

      const result = await handler({
        chainId: 1,
        to: '0x1234',
        data: '0xdeadbeef',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rejected');
      expect(result.content[0].text).toContain('No registered decoder');
      expect(ctx.policyEngine.evaluate).not.toHaveBeenCalled();
      expect(ctx.signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should log denied audit entry for unknown protocol', async () => {
      ctx = createMockContext({
        dispatcher: {
          dispatch: vi.fn().mockReturnValue({
            protocol: 'unknown',
            chainId: 1,
            to: '0x1234',
            rawData: '0xdeadbeef',
            reason: 'No registered decoder',
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignDefiCall(server, ctx);
      handler = getToolHandler(server, 'sign_defi_call');

      await handler({ chainId: 1, to: '0x1234', data: '0xdeadbeef' });

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_defi_call',
          result: 'denied',
          why: expect.stringContaining('Decoder rejection'),
        }),
      );
    });
  });

  describe('policy evaluation', () => {
    it('should pass decoded intent to policy engine', async () => {
      await handler({
        chainId: 1,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x095ea7b3000000000000000000000000',
        value: '500000000000000000',
      });

      expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          selector: '0x095ea7b3',
          amountWei: 500000000000000000n,
          intent: expect.objectContaining({ protocol: 'erc20', action: 'approve' }),
        }),
      );
    });

    it('should deny and return violations when policy rejects', async () => {
      ctx = createMockContext({
        policyEngine: {
          evaluate: vi.fn().mockReturnValue({
            allowed: false,
            violations: ['contract not in allowed list'],
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignDefiCall(server, ctx);
      handler = getToolHandler(server, 'sign_defi_call');

      const result = await handler({
        chainId: 1,
        to: '0xbad',
        data: '0x095ea7b3',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(result.content[0].text).toContain('contract not in allowed list');
      expect(ctx.signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should log denied audit entry with protocol details', async () => {
      ctx = createMockContext({
        policyEngine: {
          evaluate: vi.fn().mockReturnValue({
            allowed: false,
            violations: ['amount exceeds max'],
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignDefiCall(server, ctx);
      handler = getToolHandler(server, 'sign_defi_call');

      await handler({ chainId: 1, to: '0x1234', data: '0x095ea7b3' });

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_defi_call',
          result: 'denied',
          details: expect.objectContaining({
            protocol: 'erc20',
            action: 'approve',
          }),
        }),
      );
    });
  });

  describe('signing flow', () => {
    it('should sign and return signed tx when policy approves', async () => {
      const result = await handler({
        chainId: 1,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x095ea7b3000000000000000000000000',
        value: '100',
      });

      expect(ctx.signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          data: '0x095ea7b3000000000000000000000000',
          value: 100n,
        }),
      );
      expect(result.content[0].text).toBe('0x02f8signed');
      expect(result.isError).toBeUndefined();
    });

    it('should log approved audit entry with protocol details', async () => {
      await handler({
        chainId: 1,
        to: '0x1234',
        data: '0x095ea7b3',
      });

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_defi_call',
          result: 'approved',
          details: expect.objectContaining({
            protocol: 'erc20',
            action: 'approve',
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should return error for invalid value string', async () => {
      const result = await handler({
        chainId: 1,
        to: '0x1234',
        data: '0x095ea7b3',
        value: 'not-a-number',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid value');
      expect(ctx.signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should return error and log when signer throws', async () => {
      ctx = createMockContext({
        signer: {
          getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
          signTransaction: vi.fn().mockRejectedValue(new Error('KMS throttled')),
          signTypedData: vi.fn(),
          healthCheck: vi.fn(),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignDefiCall(server, ctx);
      handler = getToolHandler(server, 'sign_defi_call');

      const result = await handler({
        chainId: 1,
        to: '0x1234',
        data: '0x095ea7b3',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: KMS throttled');
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_defi_call',
          result: 'error',
          details: expect.objectContaining({ error: 'KMS throttled' }),
        }),
      );
    });
  });
});
