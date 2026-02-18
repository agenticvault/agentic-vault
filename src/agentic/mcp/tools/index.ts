import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';
import { registerGetAddress } from './get-address.js';
import { registerHealthCheck } from './health-check.js';
import { registerSignSwap } from './sign-swap.js';
import { registerSignPermit } from './sign-permit.js';
import { registerSignDefiCall } from './sign-defi-call.js';
import { registerSignTransaction } from './sign-transaction.js';
import { registerSignTypedData } from './sign-typed-data.js';
import { registerGetBalance } from './get-balance.js';
import { registerSendTransfer } from './send-transfer.js';
import { registerSendErc20Transfer } from './send-erc20-transfer.js';

export { type ToolContext, type ToolSigner, type ToolPolicyEngine, type ToolAuditLogger, type ToolDispatcher, type ToolRpcProvider } from './shared.js';

export interface RegisterToolsOptions {
  unsafeRawSign?: boolean;
}

export function registerTools(
  server: McpServer,
  ctx: ToolContext,
  options?: RegisterToolsOptions,
): void {
  // Always register safe tools
  registerGetAddress(server, ctx);
  registerHealthCheck(server, ctx);
  registerSignSwap(server, ctx);
  registerSignPermit(server, ctx);
  registerSignDefiCall(server, ctx);
  registerGetBalance(server, ctx);
  registerSendTransfer(server, ctx);
  registerSendErc20Transfer(server, ctx);

  // Only register unsafe tools when explicitly opted in
  if (options?.unsafeRawSign) {
    registerSignTransaction(server, ctx);
    registerSignTypedData(server, ctx);
  }
}
