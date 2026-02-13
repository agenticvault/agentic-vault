import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

const inputSchema = {
  chainId: z.number().describe('The chain ID for the transaction'),
  to: z.string().describe('The target contract address'),
  data: z.string().describe('The calldata (hex-encoded)'),
  value: z.string().optional().describe('The value in wei (decimal string)'),
};

export function registerSignSwap(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_swap', {
    description: 'Sign a swap transaction after policy validation',
    inputSchema,
  }, async (args) => {
    const to = args.to.toLowerCase() as `0x${string}`;
    const selector = args.data.length >= 10
      ? (args.data.slice(0, 10).toLowerCase() as `0x${string}`)
      : undefined;

    let amountWei: bigint | undefined;
    if (args.value) {
      try {
        amountWei = BigInt(args.value);
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'Invalid value: must be a decimal string' }],
          isError: true,
        };
      }
    }

    // Evaluate policy
    const evaluation = ctx.policyEngine.evaluate({
      chainId: args.chainId,
      to,
      selector,
      amountWei,
    });

    if (!evaluation.allowed) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_swap',
        who: 'mcp-client',
        what: `Swap signing denied for contract ${to} on chain ${args.chainId}`,
        why: `Policy violations: ${evaluation.violations.join('; ')}`,
        result: 'denied',
        details: { chainId: args.chainId, to, selector, violations: evaluation.violations },
      });

      return {
        content: [{ type: 'text' as const, text: `Policy denied: ${evaluation.violations.join('; ')}` }],
        isError: true,
      };
    }

    try {
      const signedTx = await ctx.signer.signTransaction({
        chainId: args.chainId,
        to,
        data: args.data as `0x${string}`,
        value: amountWei,
      });

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_swap',
        who: 'mcp-client',
        what: `Signed swap tx for contract ${to} on chain ${args.chainId}`,
        why: 'Swap signing approved by policy',
        result: 'approved',
        details: { chainId: args.chainId, to, selector },
      });

      return {
        content: [{ type: 'text' as const, text: signedTx }],
      };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_swap',
        who: 'mcp-client',
        what: `Failed to sign swap tx for contract ${to}`,
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
