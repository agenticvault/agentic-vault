import { describe, it, expect, vi } from 'vitest';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpServer } from '@/agentic/mcp/server.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

// ============================================================================
// Helpers
// ============================================================================

/** Access the internal _registeredTools map from an McpServer instance */
function getRegisteredToolNames(server: McpServer): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<string, unknown>;
  return Object.keys(tools);
}

function createMockContext(): ToolContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8…signedtx'),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditLogger: {
      log: vi.fn(),
    },
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Tools that are always registered regardless of unsafeRawSign */
const SAFE_TOOLS = ['get_address', 'health_check', 'sign_swap', 'sign_permit', 'sign_defi_call'] as const;

/** Tools that require unsafeRawSign to be true */
const UNSAFE_TOOLS = ['sign_transaction', 'sign_typed_data'] as const;

// ============================================================================
// Tests
// ============================================================================

describe('--unsafe-raw-sign flag', () => {
  describe('when unsafeRawSign is false (default)', () => {
    it('should register all safe tools', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: false });
      const tools = getRegisteredToolNames(server);

      for (const tool of SAFE_TOOLS) {
        expect(tools).toContain(tool);
      }
    });

    it('should NOT register sign_transaction', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: false });
      const tools = getRegisteredToolNames(server);

      expect(tools).not.toContain('sign_transaction');
    });

    it('should NOT register sign_typed_data', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: false });
      const tools = getRegisteredToolNames(server);

      expect(tools).not.toContain('sign_typed_data');
    });

    it('should have exactly 5 tools registered', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: false });
      const tools = getRegisteredToolNames(server);

      expect(tools).toHaveLength(SAFE_TOOLS.length);
    });
  });

  describe('when unsafeRawSign is undefined (omitted)', () => {
    it('should NOT register unsafe tools when flag is omitted', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx });
      const tools = getRegisteredToolNames(server);

      for (const tool of UNSAFE_TOOLS) {
        expect(tools).not.toContain(tool);
      }
    });

    it('should still register all safe tools', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx });
      const tools = getRegisteredToolNames(server);

      for (const tool of SAFE_TOOLS) {
        expect(tools).toContain(tool);
      }
    });
  });

  describe('when unsafeRawSign is true', () => {
    it('should register all safe tools', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: true });
      const tools = getRegisteredToolNames(server);

      for (const tool of SAFE_TOOLS) {
        expect(tools).toContain(tool);
      }
    });

    it('should register sign_transaction', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: true });
      const tools = getRegisteredToolNames(server);

      expect(tools).toContain('sign_transaction');
    });

    it('should register sign_typed_data', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: true });
      const tools = getRegisteredToolNames(server);

      expect(tools).toContain('sign_typed_data');
    });

    it('should have exactly 7 tools registered', () => {
      const ctx = createMockContext();
      const server = createMcpServer({ ...ctx, unsafeRawSign: true });
      const tools = getRegisteredToolNames(server);

      expect(tools).toHaveLength(SAFE_TOOLS.length + UNSAFE_TOOLS.length);
    });
  });

  describe('tool set integrity', () => {
    it('safe server is a strict subset of unsafe server', () => {
      const ctx = createMockContext();
      const safeServer = createMcpServer({ ...ctx, unsafeRawSign: false });
      const unsafeServer = createMcpServer({ ...ctx, unsafeRawSign: true });

      const safeTools = getRegisteredToolNames(safeServer);
      const unsafeTools = getRegisteredToolNames(unsafeServer);

      // Every safe tool is in the unsafe set
      for (const tool of safeTools) {
        expect(unsafeTools).toContain(tool);
      }

      // Unsafe set has more tools
      expect(unsafeTools.length).toBeGreaterThan(safeTools.length);
    });

    it('the difference between unsafe and safe sets is exactly the raw signing tools', () => {
      const ctx = createMockContext();
      const safeServer = createMcpServer({ ...ctx, unsafeRawSign: false });
      const unsafeServer = createMcpServer({ ...ctx, unsafeRawSign: true });

      const safeTools = new Set(getRegisteredToolNames(safeServer));
      const unsafeTools = new Set(getRegisteredToolNames(unsafeServer));

      const difference = [...unsafeTools].filter((t) => !safeTools.has(t));
      expect(difference.sort()).toEqual([...UNSAFE_TOOLS].sort());
    });
  });
});
