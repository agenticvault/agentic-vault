import type { WorkflowContext, WorkflowResult } from './types.js';

export interface GetBalanceInput {
  chainId: number;
  address?: string;
  token?: string;
}

const DEFAULT_SERVICE = 'agentic-vault';

export async function getBalance(ctx: WorkflowContext, input: GetBalanceInput): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;

  if (!ctx.rpcProvider) {
    ctx.auditSink.log({
      service,
      action: 'get_balance',
      who: ctx.caller,
      what: 'RPC provider not available for balance query',
      why: 'Configuration error: rpcProvider is required (pass --rpc-url)',
      result: 'error',
    });
    return { status: 'error', reason: 'RPC provider is required for get_balance (pass --rpc-url)' };
  }

  // Resolve address: use provided or fall back to signer address
  let address: `0x${string}`;
  if (input.address) {
    address = input.address.toLowerCase() as `0x${string}`;
  } else {
    if (!ctx.signer) {
      ctx.auditSink.log({
        service,
        action: 'get_balance',
        who: ctx.caller,
        what: 'Neither address nor signer available for balance query',
        why: 'Configuration error: address or signer is required',
        result: 'error',
      });
      return { status: 'error', reason: 'Address or signer is required for get_balance' };
    }
    try {
      address = await ctx.signer.getAddress();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      ctx.auditSink.log({
        service,
        action: 'get_balance',
        who: ctx.caller,
        what: 'Failed to resolve signer address',
        why: `Signer error: ${msg}`,
        result: 'error',
        details: { error: msg },
      });
      return { status: 'error', reason: `Failed to resolve signer address: ${msg}` };
    }
  }

  try {
    let balance: bigint;
    let symbol: string;

    if (input.token) {
      const token = input.token.toLowerCase() as `0x${string}`;
      balance = await ctx.rpcProvider.getErc20Balance(input.chainId, token, address);
      symbol = 'ERC20';
    } else {
      balance = await ctx.rpcProvider.getBalance(input.chainId, address);
      symbol = ctx.rpcProvider.getNativeCurrencySymbol(input.chainId);
    }

    ctx.auditSink.log({
      service,
      action: 'get_balance',
      who: ctx.caller,
      what: `Balance query for ${address} on chain ${input.chainId}: ${balance.toString()} ${symbol}`,
      why: 'Balance lookup requested',
      result: 'approved',
      details: { chainId: input.chainId, address, token: input.token, balance: balance.toString(), symbol },
    });

    return {
      status: 'approved',
      data: JSON.stringify({ balance: balance.toString(), symbol }),
      details: { chainId: input.chainId, address, balance: balance.toString(), symbol },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'get_balance',
      who: ctx.caller,
      what: `Failed to query balance for ${address} on chain ${input.chainId}`,
      why: 'RPC error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: `Balance query failed: ${msg}` };
  }
}
