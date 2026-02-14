import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, zodHexAddress, zodHexData, zodPositiveChainId } from './shared.js';

const inputSchema = {
  chainId: zodPositiveChainId.describe('The chain ID'),
  to: zodHexAddress.describe('The target address'),
  data: zodHexData.optional().describe('The calldata (hex-encoded)'),
  value: z.string().optional().describe('The value in wei (decimal string)'),
  nonce: z.number().optional().describe('The transaction nonce'),
  gas: z.string().optional().describe('The gas limit (decimal string)'),
  maxFeePerGas: z.string().optional().describe('Max fee per gas in wei'),
  maxPriorityFeePerGas: z.string().optional().describe('Max priority fee per gas in wei'),
};

export function registerSignTransaction(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_transaction', {
    description: '[UNSAFE] Sign a raw transaction. Only available when unsafeRawSign is enabled.',
    inputSchema,
  }, async (args) => {
    const to = args.to.toLowerCase() as `0x${string}`;

    try {
      const tx: Record<string, unknown> = {
        chainId: args.chainId,
        to,
        type: 'eip1559',
      };
      if (args.data) tx.data = args.data;
      if (args.value) tx.value = BigInt(args.value);
      if (args.nonce !== undefined) tx.nonce = args.nonce;
      if (args.gas) tx.gas = BigInt(args.gas);
      if (args.maxFeePerGas) tx.maxFeePerGas = BigInt(args.maxFeePerGas);
      if (args.maxPriorityFeePerGas) tx.maxPriorityFeePerGas = BigInt(args.maxPriorityFeePerGas);

      const signedTx = await ctx.signer.signTransaction(tx);

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_transaction',
        who: 'mcp-client',
        what: `Signed raw transaction to ${to} on chain ${args.chainId}`,
        why: 'Raw transaction signing (unsafeRawSign enabled)',
        result: 'approved',
        details: { chainId: args.chainId, to },
      });

      return {
        content: [{ type: 'text' as const, text: signedTx }],
      };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_transaction',
        who: 'mcp-client',
        what: `Failed to sign raw transaction to ${to}`,
        why: 'Signing error',
        result: 'error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      return {
        content: [{ type: 'text' as const, text: `Signing error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });
}
