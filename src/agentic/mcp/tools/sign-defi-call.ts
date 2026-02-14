import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, zodHexAddress, zodHexData, zodPositiveChainId } from './shared.js';
import { executeDecodedCallPipeline } from './decoded-call-pipeline.js';

const inputSchema = {
  chainId: zodPositiveChainId.describe('The chain ID for the transaction'),
  to: zodHexAddress.describe('The target contract address'),
  data: zodHexData.describe('The calldata (hex-encoded)'),
  value: z.string().optional().describe('The value in wei (decimal string)'),
};

export function registerSignDefiCall(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_defi_call', {
    description: 'Sign a DeFi contract interaction after calldata decoding and policy validation',
    inputSchema,
  }, async (args) => {
    return executeDecodedCallPipeline(ctx, 'sign_defi_call', {
      chainId: args.chainId,
      to: args.to,
      data: args.data,
      value: args.value as string | undefined,
    });
  });
}
