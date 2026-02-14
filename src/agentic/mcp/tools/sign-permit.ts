import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext, zodHexAddress, zodPositiveChainId } from './shared.js';
import { signPermit } from '../../../protocols/index.js';
import { toMcpResult } from './result-adapter.js';

const inputSchema = {
  chainId: zodPositiveChainId.describe('The chain ID'),
  token: zodHexAddress.describe('The token contract address'),
  spender: zodHexAddress.describe('The spender address'),
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
    const result = await signPermit(
      {
        signer: ctx.signer,
        policyEngine: ctx.policyEngine,
        auditSink: ctx.auditLogger,
        caller: 'mcp-client',
        service: 'agentic-vault-mcp',
      },
      {
        chainId: args.chainId,
        token: args.token,
        spender: args.spender,
        value: args.value,
        deadline: args.deadline,
        domain: args.domain,
        types: args.types,
        message: args.message,
      },
    );
    return toMcpResult(result);
  });
}
