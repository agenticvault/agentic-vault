import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, zodHexAddress, zodPositiveChainId } from './shared.js';
import { getBalanceWorkflow } from '../../../protocols/index.js';
import { toMcpResult } from './result-adapter.js';

const inputSchema = {
  chainId: zodPositiveChainId.describe('The chain ID to query'),
  address: zodHexAddress.optional().describe('The address to query (defaults to vault address)'),
  token: zodHexAddress.optional().describe('ERC20 token address (omit for native ETH balance)'),
};

export function registerGetBalance(server: McpServer, ctx: ToolContext): void {
  server.registerTool('get_balance', {
    description: 'Query native ETH or ERC20 token balance for an address',
    inputSchema,
  }, async (args) => {
    const result = await getBalanceWorkflow(
      {
        signer: ctx.signer,
        policyEngine: ctx.policyEngine,
        auditSink: ctx.auditLogger,
        rpcProvider: ctx.rpcProvider,
        caller: 'mcp-client',
        service: 'agentic-vault-mcp',
      },
      {
        chainId: args.chainId,
        address: args.address as string | undefined,
        token: args.token as string | undefined,
      },
    );
    return toMcpResult(result);
  });
}
