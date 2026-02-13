import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSignTypedData } from '@/agentic/mcp/tools/sign-typed-data.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

// ============================================================================
// Helpers
// ============================================================================

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
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

const SAMPLE_ARGS = {
  domain: { name: 'TestDApp', version: '1', chainId: 1 },
  types: { Message: [{ name: 'content', type: 'string' }] },
  primaryType: 'Message',
  message: { content: 'Hello' },
};

// ============================================================================
// Tests
// ============================================================================

describe('sign_typed_data tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (args: Record<string, unknown>) => Promise<any>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSignTypedData(server, ctx);
    handler = getToolHandler(server, 'sign_typed_data');
  });

  it('should register the sign_typed_data tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  describe('happy path', () => {
    it('should sign typed data and return JSON stringified signature', async () => {
      const result = await handler(SAMPLE_ARGS);

      expect(ctx.signer.signTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: SAMPLE_ARGS.domain,
          types: SAMPLE_ARGS.types,
          primaryType: 'Message',
          message: SAMPLE_ARGS.message,
        }),
      );
      expect(result.content[0].text).toBe(JSON.stringify({ v: 27, r: '0xabc', s: '0xdef' }));
      expect(result.isError).toBeUndefined();
    });
  });

  describe('audit logging', () => {
    it('should log approved audit entry with primaryType', async () => {
      await handler(SAMPLE_ARGS);

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_typed_data',
          result: 'approved',
          details: expect.objectContaining({ primaryType: 'Message' }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should return error and log when signer throws Error', async () => {
      ctx = createMockContext({
        signer: {
          getAddress: vi.fn(),
          signTransaction: vi.fn(),
          signTypedData: vi.fn().mockRejectedValue(new Error('Invalid domain')),
          healthCheck: vi.fn(),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignTypedData(server, ctx);
      handler = getToolHandler(server, 'sign_typed_data');

      const result = await handler(SAMPLE_ARGS);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: Invalid domain');
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_typed_data',
          result: 'error',
          details: expect.objectContaining({ error: 'Invalid domain' }),
        }),
      );
    });

    it('should handle non-Error throws gracefully', async () => {
      ctx = createMockContext({
        signer: {
          getAddress: vi.fn(),
          signTransaction: vi.fn(),
          signTypedData: vi.fn().mockRejectedValue(42),
          healthCheck: vi.fn(),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignTypedData(server, ctx);
      handler = getToolHandler(server, 'sign_typed_data');

      const result = await handler(SAMPLE_ARGS);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: 42');
    });
  });
});
