import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, zodHexAddress, zodPositiveChainId } from './shared.js';
import { sendTransfer as sendTransferWorkflow } from '../../../protocols/index.js';
import { toMcpResult } from './result-adapter.js';

const inputSchema = {
  chainId: zodPositiveChainId.describe('The chain ID for the transaction'),
  to: zodHexAddress.describe('The recipient address'),
  value: z.string().describe('Amount in wei (decimal string)'),
};

export function registerSendTransfer(server: McpServer, ctx: ToolContext): void {
  server.registerTool('send_transfer', {
    description: 'Send native ETH transfer after policy validation, sign and broadcast',
    inputSchema,
  }, async (args) => {
    const result = await sendTransferWorkflow(
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
        to: args.to,
        value: args.value,
      },
    );
    return toMcpResult(result);
  });
}
