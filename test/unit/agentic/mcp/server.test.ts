import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpServer, type McpServerOptions } from '@/agentic/mcp/server.js';

// ============================================================================
// Mock StdioServerTransport
// ============================================================================

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class MockStdioTransport {},
  };
});

// ============================================================================
// Helpers
// ============================================================================

function createMockOptions(overrides?: Partial<McpServerOptions>): McpServerOptions {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
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

// ============================================================================
// Tests
// ============================================================================

describe('MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMcpServer', () => {
    it('should create a server with default name and version', () => {
      const server = createMcpServer(createMockOptions());

      expect(server).toBeInstanceOf(McpServer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info = (server.server as any)._serverInfo as { name: string; version: string };
      expect(info.name).toBe('agentic-vault-mcp');
      expect(info.version).toBe('0.3.0');
    });

    it('should create a server with custom name and version', () => {
      const server = createMcpServer(
        createMockOptions({ name: 'custom-vault', version: '1.0.0' }),
      );

      expect(server).toBeInstanceOf(McpServer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info = (server.server as any)._serverInfo as { name: string; version: string };
      expect(info.name).toBe('custom-vault');
      expect(info.version).toBe('1.0.0');
    });

    it('should register safe tools by default', () => {
      const server = createMcpServer(createMockOptions());

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (server as any)._registeredTools as Record<string, unknown>;
      expect(tools['get_address']).toBeDefined();
      expect(tools['health_check']).toBeDefined();
      expect(tools['sign_swap']).toBeDefined();
      expect(tools['sign_permit']).toBeDefined();
    });

    it('should not register unsafe tools by default', () => {
      const server = createMcpServer(createMockOptions());

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (server as any)._registeredTools as Record<string, unknown>;
      expect(tools['sign_transaction']).toBeUndefined();
      expect(tools['sign_typed_data']).toBeUndefined();
    });

    it('should register unsafe tools when unsafeRawSign is true', () => {
      const server = createMcpServer(
        createMockOptions({ unsafeRawSign: true }),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (server as any)._registeredTools as Record<string, unknown>;
      expect(tools['sign_transaction']).toBeDefined();
      expect(tools['sign_typed_data']).toBeDefined();
    });
  });

  describe('startStdioServer', () => {
    it('should create server and connect transport', async () => {
      const { startStdioServer } = await import('@/agentic/mcp/server.js');

      // McpServer.connect expects a Transport with start/send/close methods
      // Since we mock StdioServerTransport, we also need to spy on server.connect
      const connectSpy = vi.spyOn(McpServer.prototype, 'connect').mockResolvedValue(undefined);

      const server = await startStdioServer(createMockOptions());

      expect(server).toBeInstanceOf(McpServer);
      expect(connectSpy).toHaveBeenCalled();

      connectSpy.mockRestore();
    });
  });
});
