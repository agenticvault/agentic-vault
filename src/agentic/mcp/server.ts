import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProtocolDispatcher, createDefaultRegistry } from '../../protocols/index.js';
import { registerTools, type RegisterToolsOptions, type ToolContext } from './tools/index.js';

export interface McpServerOptions extends ToolContext, RegisterToolsOptions {
  name?: string;
  version?: string;
}

export function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({
    name: options.name ?? 'agentic-vault-mcp',
    version: options.version ?? '0.3.0',
  });

  const ctx: ToolContext = {
    signer: options.signer,
    policyEngine: options.policyEngine,
    auditLogger: options.auditLogger,
    dispatcher: options.dispatcher ?? new ProtocolDispatcher(createDefaultRegistry()),
  };

  registerTools(server, ctx, { unsafeRawSign: options.unsafeRawSign });

  return server;
}

export async function startStdioServer(options: McpServerOptions): Promise<McpServer> {
  const server = createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
