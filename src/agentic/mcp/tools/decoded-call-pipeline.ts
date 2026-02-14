import { type ToolContext } from './shared.js';
import { signDefiCall } from '../../../protocols/index.js';
import { toMcpResult, type McpToolResult } from './result-adapter.js';

interface DecodedCallArgs {
  chainId: number;
  to: string;
  data: string;
  value?: string;
}

/**
 * MCP adapter for decoded-call signing workflow.
 * Delegates to signDefiCall() and converts WorkflowResult to MCP format.
 */
export async function executeDecodedCallPipeline(
  ctx: ToolContext,
  toolName: string,
  args: DecodedCallArgs,
): Promise<McpToolResult> {
  const result = await signDefiCall(
    {
      signer: ctx.signer,
      policyEngine: ctx.policyEngine,
      auditSink: ctx.auditLogger,
      dispatcher: ctx.dispatcher,
      caller: 'mcp-client',
      service: 'agentic-vault-mcp',
    },
    toolName,
    args,
  );
  return toMcpResult(result);
}
