import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHealthCheck } from '@/agentic/mcp/tools/health-check.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

// ============================================================================
// Types
// ============================================================================

type ToolHandlerResult = { content: { type: string; text: string }[]; isError?: boolean };

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
    { handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult> }
  >;
  return tools[toolName].handler;
}

// ============================================================================
// Tests
// ============================================================================

describe('health_check tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
   
  let handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerHealthCheck(server, ctx);
    handler = getToolHandler(server, 'health_check');
  });

  it('should register the health_check tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should return healthy status when signer is healthy', async () => {
    const result = await handler({});

    expect(ctx.signer.healthCheck).toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text)).toEqual({ status: 'healthy' });
    expect(result.isError).toBeUndefined();
  });

  it('should log approved audit entry on healthy check', async () => {
    await handler({});

    expect(ctx.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'agentic-vault-mcp',
        action: 'health_check',
        result: 'approved',
      }),
    );
  });

  it('should return unhealthy status when signer throws Error', async () => {
    ctx = createMockContext({
      signer: {
        getAddress: vi.fn(),
        signTransaction: vi.fn(),
        signTypedData: vi.fn(),
        healthCheck: vi.fn().mockRejectedValue(new Error('KMS unreachable')),
      },
    });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerHealthCheck(server, ctx);
    handler = getToolHandler(server, 'health_check');

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: 'unhealthy',
      error: 'KMS unreachable',
    });
    expect(ctx.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'health_check',
        result: 'error',
        details: expect.objectContaining({ error: 'KMS unreachable' }),
      }),
    );
  });

  it('should handle non-Error throws gracefully', async () => {
    ctx = createMockContext({
      signer: {
        getAddress: vi.fn(),
        signTransaction: vi.fn(),
        signTypedData: vi.fn(),
        healthCheck: vi.fn().mockRejectedValue('connection refused'),
      },
    });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerHealthCheck(server, ctx);
    handler = getToolHandler(server, 'health_check');

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: 'unhealthy',
      error: 'connection refused',
    });
  });
});
