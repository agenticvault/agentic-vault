import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';
import { healthCheckWorkflow } from '../../../protocols/index.js';

export function registerHealthCheck(server: McpServer, ctx: ToolContext): void {
  server.registerTool('health_check', {
    description: 'Check the health status of the vault signer',
  }, async () => {
    const result = await healthCheckWorkflow({
      signer: ctx.signer,
      policyEngine: ctx.policyEngine,
      auditSink: ctx.auditLogger,
      caller: 'mcp-client',
      service: 'agentic-vault-mcp',
    });

    switch (result.status) {
      case 'approved':
        return { content: [{ type: 'text' as const, text: result.data }] };
      case 'error':
        return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'unhealthy', error: result.reason }) }], isError: true };
      case 'denied':
        return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'unhealthy', error: result.reason }) }], isError: true };
      default:
        return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'unhealthy', error: 'Unexpected result' }) }], isError: true };
    }
  });
}
