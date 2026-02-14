import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';
import { getAddressWorkflow } from '../../../protocols/index.js';

export function registerGetAddress(server: McpServer, ctx: ToolContext): void {
  server.registerTool('get_address', {
    description: 'Get the wallet address managed by this vault',
  }, async () => {
    const result = await getAddressWorkflow({
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
        return { content: [{ type: 'text' as const, text: `Error: ${result.reason}` }], isError: true };
      case 'denied':
        return { content: [{ type: 'text' as const, text: `Error: ${result.reason}` }], isError: true };
      default:
        return { content: [{ type: 'text' as const, text: 'Unexpected result' }], isError: true };
    }
  });
}
