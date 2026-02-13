import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

export function registerHealthCheck(server: McpServer, ctx: ToolContext): void {
  server.registerTool('health_check', {
    description: 'Check the health status of the vault signer',
  }, async () => {
    try {
      await ctx.signer.healthCheck();

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'health_check',
        who: 'mcp-client',
        what: 'Health check passed',
        why: 'Health check requested',
        result: 'approved',
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status: 'healthy' }) }],
      };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'health_check',
        who: 'mcp-client',
        what: 'Health check failed',
        why: 'Health check requested',
        result: 'error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status: 'unhealthy', error: error instanceof Error ? error.message : String(error) }) }],
        isError: true,
      };
    }
  });
}
