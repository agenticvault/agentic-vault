import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

const inputSchema = {
  chainId: z.number().describe('The chain ID'),
  token: z.string().describe('The token contract address'),
  spender: z.string().describe('The spender address'),
  value: z.string().describe('The permit value in wei (decimal string)'),
  deadline: z.number().describe('The permit deadline (unix timestamp)'),
  domain: z.record(z.string(), z.unknown()).describe('The EIP-712 domain'),
  types: z.record(z.string(), z.unknown()).describe('The EIP-712 types'),
  message: z.record(z.string(), z.unknown()).describe('The EIP-712 message'),
};

export function registerSignPermit(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_permit', {
    description: 'Sign an EIP-2612 permit after policy validation',
    inputSchema,
  }, async (args) => {
    const token = args.token.toLowerCase() as `0x${string}`;

    // Parse value safely
    let amountWei: bigint;
    try {
      amountWei = BigInt(args.value);
    } catch {
      return {
        content: [{ type: 'text' as const, text: 'Invalid value: must be a decimal string' }],
        isError: true,
      };
    }

    // Evaluate policy
    const evaluation = ctx.policyEngine.evaluate({
      chainId: args.chainId,
      to: token,
      amountWei,
      deadline: args.deadline,
    });

    if (!evaluation.allowed) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_permit',
        who: 'mcp-client',
        what: `Permit signing denied for token ${token} on chain ${args.chainId}`,
        why: `Policy violations: ${evaluation.violations.join('; ')}`,
        result: 'denied',
        details: { chainId: args.chainId, token, spender: args.spender, violations: evaluation.violations },
      });

      return {
        content: [{ type: 'text' as const, text: `Policy denied: ${evaluation.violations.join('; ')}` }],
        isError: true,
      };
    }

    // Validate EIP-712 domain matches policy-checked values (prevent bypass)
    const domain = args.domain as { verifyingContract?: string; chainId?: number };
    if (domain.verifyingContract && domain.verifyingContract.toLowerCase() !== token) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_permit',
        who: 'mcp-client',
        what: `Permit payload mismatch: domain.verifyingContract (${domain.verifyingContract}) !== token (${token})`,
        why: 'Payload/metadata consistency check failed',
        result: 'denied',
        details: { chainId: args.chainId, token, domainContract: domain.verifyingContract },
      });

      return {
        content: [{ type: 'text' as const, text: `Payload mismatch: domain.verifyingContract does not match token` }],
        isError: true,
      };
    }

    if (domain.chainId != null && domain.chainId !== args.chainId) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_permit',
        who: 'mcp-client',
        what: `Permit payload mismatch: domain.chainId (${domain.chainId}) !== args.chainId (${args.chainId})`,
        why: 'Payload/metadata consistency check failed',
        result: 'denied',
        details: { argsChainId: args.chainId, domainChainId: domain.chainId },
      });

      return {
        content: [{ type: 'text' as const, text: `Payload mismatch: domain.chainId does not match chainId` }],
        isError: true,
      };
    }

    try {
      const sig = await ctx.signer.signTypedData({
        domain: args.domain,
        types: args.types,
        primaryType: 'Permit',
        message: args.message,
      });

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_permit',
        who: 'mcp-client',
        what: `Signed permit for token ${token} on chain ${args.chainId}`,
        why: 'Permit signing approved by policy',
        result: 'approved',
        details: { chainId: args.chainId, token, spender: args.spender },
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(sig) }],
      };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_permit',
        who: 'mcp-client',
        what: `Failed to sign permit for token ${token}`,
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
