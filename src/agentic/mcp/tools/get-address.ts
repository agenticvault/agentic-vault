import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

export function registerGetAddress(server: McpServer, ctx: ToolContext): void {
  server.registerTool('get_address', {
    description: 'Get the wallet address managed by this vault',
  }, async () => {
    try {
      const address = await ctx.signer.getAddress();

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'get_address',
        who: 'mcp-client',
        what: `Retrieved wallet address: ${address}`,
        why: 'Address lookup requested',
        result: 'approved',
      });

      return {
        content: [{ type: 'text' as const, text: address }],
      };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'get_address',
        who: 'mcp-client',
        what: 'Failed to retrieve wallet address',
        why: 'Address lookup requested',
        result: 'error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      return {
        content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });
}
