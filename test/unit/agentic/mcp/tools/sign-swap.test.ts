import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSignSwap } from '@/agentic/mcp/tools/sign-swap.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

// ============================================================================
// Helpers
// ============================================================================

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8...signedtx'),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc...', s: '0xdef...' }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditLogger: {
      log: vi.fn(),
    },
    ...overrides,
  };
}

function getToolHandler(server: McpServer, toolName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    { handler: (args: Record<string, unknown>) => Promise<any> }
  >;
  return tools[toolName].handler;
}

// ============================================================================
// Tests
// ============================================================================

describe('sign_swap tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  let handler: (args: Record<string, unknown>) => Promise<any>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSignSwap(server, ctx);
    handler = getToolHandler(server, 'sign_swap');
  });

  it('should register the sign_swap tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  describe('policy approval flow', () => {
    it('should call signer and return signed tx when policy approves', async () => {
      const result = await handler({
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed1739000000000000000000000000',
        value: '1000000000000000000',
      });

      expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0x1234567890abcdef1234567890abcdef12345678',
          selector: '0x38ed1739',
          amountWei: 1000000000000000000n,
        }),
      );
      expect(ctx.signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0x1234567890abcdef1234567890abcdef12345678',
          data: '0x38ed1739000000000000000000000000',
          value: 1000000000000000000n,
        }),
      );
      expect(result.content[0].text).toBe('0x02f8...signedtx');
      expect(result.isError).toBeUndefined();
    });

    it('should log approved audit entry when policy passes', async () => {
      await handler({
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed1739000000000000000000000000',
      });

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_swap',
          result: 'approved',
        }),
      );
    });
  });

  describe('policy denial flow', () => {
    it('should return error and NOT call signer when policy denies', async () => {
      ctx = createMockContext({
        policyEngine: {
          evaluate: vi.fn().mockReturnValue({
            allowed: false,
            violations: ['chainId 999 not in allowed list'],
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignSwap(server, ctx);
      handler = getToolHandler(server, 'sign_swap');

      const result = await handler({
        chainId: 999,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed1739000000000000000000000000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(result.content[0].text).toContain('chainId 999 not in allowed list');
      expect(ctx.signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should log denied audit entry when policy fails', async () => {
      ctx = createMockContext({
        policyEngine: {
          evaluate: vi.fn().mockReturnValue({
            allowed: false,
            violations: ['contract not in allowed list'],
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignSwap(server, ctx);
      handler = getToolHandler(server, 'sign_swap');

      await handler({
        chainId: 1,
        to: '0xdeadbeef',
        data: '0x38ed1739',
      });

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_swap',
          result: 'denied',
          why: expect.stringContaining('contract not in allowed list'),
        }),
      );
    });
  });

  describe('invalid value handling', () => {
    it('should return error for invalid value string', async () => {
      const result = await handler({
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed1739',
        value: 'not-a-number',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Invalid value: must be a decimal string');
      expect(ctx.policyEngine.evaluate).not.toHaveBeenCalled();
      expect(ctx.signer.signTransaction).not.toHaveBeenCalled();
    });
  });

  describe('selector extraction', () => {
    it('should extract first 4 bytes from data as selector', async () => {
      await handler({
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed1739000000000000000000000000',
      });

      expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '0x38ed1739',
        }),
      );
    });

    it('should pass undefined selector when data is shorter than 10 chars', async () => {
      await handler({
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed',
      });

      expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: undefined,
        }),
      );
    });
  });

  describe('signing error handling', () => {
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
      registerSignSwap(server, ctx);
      handler = getToolHandler(server, 'sign_swap');

      const result = await handler({
        chainId: 1,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        data: '0x38ed1739',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: KMS throttled');
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_swap',
          result: 'error',
          details: expect.objectContaining({ error: 'KMS throttled' }),
        }),
      );
    });
  });
});
