import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSignTransaction } from '@/agentic/mcp/tools/sign-transaction.js';
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

describe('sign_transaction tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (args: Record<string, unknown>) => Promise<any>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSignTransaction(server, ctx);
    handler = getToolHandler(server, 'sign_transaction');
  });

  it('should register the sign_transaction tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  describe('happy path', () => {
    it('should sign with minimal args (chainId + to)', async () => {
      const result = await handler({
        chainId: 1,
        to: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      });

      expect(ctx.signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0xabcdef1234567890abcdef1234567890abcdef12',
          type: 'eip1559',
        }),
      );
      expect(result.content[0].text).toBe('0x02f8...signedtx');
      expect(result.isError).toBeUndefined();
    });

    it('should pass all optional fields when provided', async () => {
      const result = await handler({
        chainId: 1,
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
        data: '0x38ed1739',
        value: '1000000000000000000',
        nonce: 42,
        gas: '21000',
        maxFeePerGas: '30000000000',
        maxPriorityFeePerGas: '2000000000',
      });

      expect(ctx.signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0xabcdef1234567890abcdef1234567890abcdef12',
          type: 'eip1559',
          data: '0x38ed1739',
          value: 1000000000000000000n,
          nonce: 42,
          gas: 21000n,
          maxFeePerGas: 30000000000n,
          maxPriorityFeePerGas: 2000000000n,
        }),
      );
      expect(result.isError).toBeUndefined();
    });

    it('should handle nonce: 0 (falsy but valid)', async () => {
      await handler({
        chainId: 1,
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
        nonce: 0,
      });

      expect(ctx.signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ nonce: 0 }),
      );
    });

    it('should lowercase the to address', async () => {
      await handler({
        chainId: 1,
        to: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      });

      expect(ctx.signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '0xabcdef1234567890abcdef1234567890abcdef12',
        }),
      );
    });
  });

  describe('audit logging', () => {
    it('should log approved audit entry on success', async () => {
      await handler({
        chainId: 1,
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
      });

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_transaction',
          result: 'approved',
          details: expect.objectContaining({ chainId: 1 }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should return error and log when signer throws Error', async () => {
      ctx = createMockContext({
        signer: {
          getAddress: vi.fn(),
          signTransaction: vi.fn().mockRejectedValue(new Error('KMS throttled')),
          signTypedData: vi.fn(),
          healthCheck: vi.fn(),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignTransaction(server, ctx);
      handler = getToolHandler(server, 'sign_transaction');

      const result = await handler({
        chainId: 1,
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: KMS throttled');
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_transaction',
          result: 'error',
          details: expect.objectContaining({ error: 'KMS throttled' }),
        }),
      );
    });

    it('should handle non-Error throws gracefully', async () => {
      ctx = createMockContext({
        signer: {
          getAddress: vi.fn(),
          signTransaction: vi.fn().mockRejectedValue('raw string error'),
          signTypedData: vi.fn(),
          healthCheck: vi.fn(),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignTransaction(server, ctx);
      handler = getToolHandler(server, 'sign_transaction');

      const result = await handler({
        chainId: 1,
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: raw string error');
    });
  });
});
