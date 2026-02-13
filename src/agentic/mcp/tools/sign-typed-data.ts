import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

const inputSchema = {
  domain: z.record(z.string(), z.unknown()).describe('The EIP-712 domain'),
  types: z.record(z.string(), z.unknown()).describe('The EIP-712 types'),
  primaryType: z.string().describe('The primary type name'),
  message: z.record(z.string(), z.unknown()).describe('The EIP-712 message'),
};

export function registerSignTypedData(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_typed_data', {
    description: '[UNSAFE] Sign raw EIP-712 typed data. Only available when unsafeRawSign is enabled.',
    inputSchema,
  }, async (args) => {
    try {
      const sig = await ctx.signer.signTypedData({
        domain: args.domain,
        types: args.types,
        primaryType: args.primaryType,
        message: args.message,
      });

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_typed_data',
        who: 'mcp-client',
        what: `Signed typed data with primaryType ${args.primaryType}`,
        why: 'Raw typed data signing (unsafeRawSign enabled)',
        result: 'approved',
        details: { primaryType: args.primaryType },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(sig) }],
      };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_typed_data',
        who: 'mcp-client',
        what: `Failed to sign typed data with primaryType ${args.primaryType}`,
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
