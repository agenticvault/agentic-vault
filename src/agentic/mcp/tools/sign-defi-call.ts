import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

const inputSchema = {
  chainId: z.number().describe('The chain ID for the transaction'),
  to: z.string().describe('The target contract address'),
  data: z.string().describe('The calldata (hex-encoded)'),
  value: z.string().optional().describe('The value in wei (decimal string)'),
};

export function registerSignDefiCall(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_defi_call', {
    description: 'Sign a DeFi contract interaction after calldata decoding and policy validation',
    inputSchema,
  }, async (args) => {
    const to = args.to.toLowerCase() as `0x${string}`;
    const data = args.data as `0x${string}`;

    // 1. Require dispatcher
    if (!ctx.dispatcher) {
      throw new Error('sign_defi_call requires dispatcher in ToolContext');
    }

    // 2. Decode calldata
    const intent = ctx.dispatcher.dispatch(args.chainId, to, data);

    // 3. Reject unknown protocols (fail-closed)
    if (intent.protocol === 'unknown') {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Rejected unknown calldata for ${to} on chain ${args.chainId}`,
        why: `Decoder rejection: ${intent.reason}`,
        result: 'denied',
        details: { chainId: args.chainId, to, reason: intent.reason },
      });
      return {
        content: [{ type: 'text' as const,
          text: `Rejected: ${intent.reason}` }],
        isError: true,
      };
    }

    // 4. Parse value
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

    // 5. Policy evaluation with decoded intent
    const evaluation = ctx.policyEngine.evaluate({
      chainId: args.chainId,
      to,
      selector: 'selector' in intent ? intent.selector : undefined,
      amountWei,
      intent,
    });

    if (!evaluation.allowed) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Policy denied ${intent.protocol}:${intent.action} on chain ${args.chainId}`,
        why: `Violations: ${evaluation.violations.join('; ')}`,
        result: 'denied',
        details: {
          chainId: args.chainId, to, protocol: intent.protocol,
          action: intent.action, violations: evaluation.violations,
        },
      });
      return {
        content: [{ type: 'text' as const,
          text: `Policy denied: ${evaluation.violations.join('; ')}` }],
        isError: true,
      };
    }

    // 6. Sign
    try {
      const signedTx = await ctx.signer.signTransaction({
        chainId: args.chainId,
        to,
        data,
        value: amountWei,
      });

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Signed ${intent.protocol}:${intent.action} for ${to} on chain ${args.chainId}`,
        why: 'Approved by decoder + policy',
        result: 'approved',
        details: { chainId: args.chainId, to, protocol: intent.protocol, action: intent.action },
      });

      return { content: [{ type: 'text' as const, text: signedTx }] };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Failed to sign ${intent.protocol}:${intent.action}`,
        why: 'Signing error',
        result: 'error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      return {
        content: [{ type: 'text' as const,
          text: `Signing error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });
}
