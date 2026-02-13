import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetAddress } from '@/agentic/mcp/tools/get-address.js';
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

describe('get_address tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  let handler: (args: Record<string, unknown>) => Promise<any>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerGetAddress(server, ctx);
    handler = getToolHandler(server, 'get_address');
  });

  it('should register the get_address tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should return signer address when invoked', async () => {
    const result = await handler({});

    expect(ctx.signer.getAddress).toHaveBeenCalled();
    expect(result.content[0].text).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(result.isError).toBeUndefined();
  });

  it('should log approved audit entry on success', async () => {
    await handler({});

    expect(ctx.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'agentic-vault-mcp',
        action: 'get_address',
        who: 'mcp-client',
        what: expect.stringContaining('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        result: 'approved',
      }),
    );
  });

  it('should return error when signer throws', async () => {
    ctx = createMockContext({
      signer: {
        getAddress: vi.fn().mockRejectedValue(new Error('KMS unavailable')),
        signTransaction: vi.fn(),
        signTypedData: vi.fn(),
        healthCheck: vi.fn(),
      },
    });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerGetAddress(server, ctx);
    handler = getToolHandler(server, 'get_address');

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: KMS unavailable');
    expect(ctx.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'agentic-vault-mcp',
        action: 'get_address',
        result: 'error',
        details: expect.objectContaining({ error: 'KMS unavailable' }),
      }),
    );
  });
});
