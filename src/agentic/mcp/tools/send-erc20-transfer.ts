import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, zodHexAddress, zodPositiveChainId } from './shared.js';
import { sendErc20Transfer as sendErc20TransferWorkflow } from '../../../protocols/index.js';
import { toMcpResult } from './result-adapter.js';

const inputSchema = {
  chainId: zodPositiveChainId.describe('The chain ID for the transaction'),
  token: zodHexAddress.describe('The ERC20 token contract address'),
  to: zodHexAddress.describe('The recipient address'),
  amount: z.string().describe('Amount in smallest unit (decimal string)'),
};

export function registerSendErc20Transfer(server: McpServer, ctx: ToolContext): void {
  server.registerTool('send_erc20_transfer', {
    description: 'Send ERC20 token transfer after policy validation, sign and broadcast',
    inputSchema,
  }, async (args) => {
    const result = await sendErc20TransferWorkflow(
      {
        signer: ctx.signer,
        policyEngine: ctx.policyEngine,
        auditSink: ctx.auditLogger,
        dispatcher: ctx.dispatcher,
        rpcProvider: ctx.rpcProvider,
        caller: 'mcp-client',
        service: 'agentic-vault-mcp',
      },
      {
        chainId: args.chainId,
        token: args.token,
        to: args.to,
        amount: args.amount,
      },
    );
    return toMcpResult(result);
  });
}
