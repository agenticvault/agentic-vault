import { encodeFunctionData } from 'viem';
import type { WorkflowContext, WorkflowResult } from './types.js';
import { erc20TransferAbi } from '../catalog.js';

export interface SendTransferInput {
  chainId: number;
  to: string;
  value: string; // wei decimal string
}

export interface SendErc20TransferInput {
  chainId: number;
  token: string;
  to: string;
  amount: string; // smallest unit decimal string
}

const DEFAULT_SERVICE = 'agentic-vault';

const EXPLORER_MAP: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  42161: 'https://arbiscan.io',
  8453: 'https://basescan.org',
  137: 'https://polygonscan.com',
};

function buildExplorerUrl(chainId: number, txHash: string): string | undefined {
  const base = EXPLORER_MAP[chainId];
  return base ? `${base}/tx/${txHash}` : undefined;
}

export async function sendTransfer(ctx: WorkflowContext, input: SendTransferInput): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;
  const to = input.to.toLowerCase() as `0x${string}`;

  // Parse and validate value
  let value: bigint;
  try {
    value = BigInt(input.value);
  } catch {
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: `Invalid value parameter: ${input.value}`,
      why: 'Input validation: value must be a decimal string',
      result: 'error',
    });
    return { status: 'error', reason: 'Invalid value: must be a decimal string' };
  }
  if (value < 0n) {
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: `Negative value rejected: ${input.value}`,
      why: 'Input validation: value must be non-negative',
      result: 'error',
    });
    return { status: 'error', reason: 'Invalid value: must be non-negative' };
  }

  // Policy evaluation (native ETH — no selector, no intent)
  const evaluation = ctx.policyEngine.evaluate({
    chainId: input.chainId,
    to,
    amountWei: value,
  });

  if (!evaluation.allowed) {
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: `Policy denied native transfer to ${to} on chain ${input.chainId}`,
      why: `Violations: ${evaluation.violations.join('; ')}`,
      result: 'denied',
      details: { chainId: input.chainId, to, value: value.toString(), violations: evaluation.violations },
    });
    return {
      status: 'denied',
      reason: `Policy denied: ${evaluation.violations.join('; ')}`,
      violations: evaluation.violations,
    };
  }

  // Dry-run: return policy evaluation without signing/broadcasting
  if (ctx.dryRun) {
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: `Dry-run approved native transfer to ${to} on chain ${input.chainId}`,
      why: 'Approved by policy (dry-run)',
      result: 'approved',
      details: { chainId: input.chainId, to, value: value.toString(), dryRun: true },
    });
    return {
      status: 'dry-run-approved',
      details: { chainId: input.chainId, to, value: value.toString() },
    };
  }

  // RPC provider required for actual broadcast (after dry-run check)
  if (!ctx.rpcProvider) {
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: 'RPC provider not available for transfer',
      why: 'Configuration error: rpcProvider is required (pass --rpc-url)',
      result: 'error',
    });
    return { status: 'error', reason: 'RPC provider is required for send_transfer (pass --rpc-url)' };
  }

  // Signer required for actual broadcast (after dry-run check)
  if (!ctx.signer) {
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: 'Signer not available for transfer',
      why: 'Configuration error: signer is required when dryRun is not enabled',
      result: 'error',
    });
    return { status: 'error', reason: 'Signer is required when dryRun is not enabled' };
  }

  try {
    const from = await ctx.signer.getAddress();
    const nonce = await ctx.rpcProvider.getTransactionCount(input.chainId, from);
    const gas = await ctx.rpcProvider.estimateGas(input.chainId, { from, to, value });
    const fees = await ctx.rpcProvider.estimateFeesPerGas(input.chainId);

    const signedTx = await ctx.signer.signTransaction({
      chainId: input.chainId,
      to,
      value,
      nonce,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      type: 'eip1559',
    });

    const txHash = await ctx.rpcProvider.sendRawTransaction(input.chainId, signedTx);
    const explorerUrl = buildExplorerUrl(input.chainId, txHash);

    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: `Sent ${value.toString()} wei to ${to} on chain ${input.chainId}`,
      why: 'Native transfer approved by policy',
      result: 'approved',
      details: { chainId: input.chainId, to, value: value.toString(), txHash, explorerUrl },
    });

    return {
      status: 'approved',
      data: JSON.stringify({ txHash, explorerUrl }),
      details: { txHash, explorerUrl },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'send_transfer',
      who: ctx.caller,
      what: `Failed to send native transfer to ${to} on chain ${input.chainId}`,
      why: 'Transfer error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: `Transfer failed: ${msg}` };
  }
}

export async function sendErc20Transfer(ctx: WorkflowContext, input: SendErc20TransferInput): Promise<WorkflowResult> {
  const service = ctx.service ?? DEFAULT_SERVICE;
  const token = input.token.toLowerCase() as `0x${string}`;
  const to = input.to.toLowerCase() as `0x${string}`;

  if (!ctx.dispatcher) {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: 'Dispatcher not available for ERC20 transfer',
      why: 'Configuration error: dispatcher is required',
      result: 'error',
    });
    return { status: 'error', reason: 'Dispatcher is required for send_erc20_transfer' };
  }

  // Parse and validate amount
  let amount: bigint;
  try {
    amount = BigInt(input.amount);
  } catch {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Invalid amount parameter: ${input.amount}`,
      why: 'Input validation: amount must be a decimal string',
      result: 'error',
    });
    return { status: 'error', reason: 'Invalid amount: must be a decimal string' };
  }
  if (amount < 0n) {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Negative amount rejected: ${input.amount}`,
      why: 'Input validation: amount must be non-negative',
      result: 'error',
    });
    return { status: 'error', reason: 'Invalid amount: must be non-negative' };
  }

  // Encode calldata and decode via dispatcher (guarded by try/catch for audit)
  let calldata: `0x${string}`;
  let intent: ReturnType<typeof ctx.dispatcher.dispatch>;
  try {
    calldata = encodeFunctionData({
      abi: [erc20TransferAbi],
      args: [to, amount],
    });
    intent = ctx.dispatcher.dispatch(input.chainId, token, calldata);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Failed to encode/decode ERC20 transfer for token ${token} on chain ${input.chainId}`,
      why: 'Encode/decode error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: `ERC20 encode/decode failed: ${msg}` };
  }

  // Reject unknown protocols (fail-closed)
  if (intent.protocol === 'unknown') {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Rejected unknown calldata for token ${token} on chain ${input.chainId}`,
      why: `Decoder rejection: ${intent.reason}`,
      result: 'denied',
      details: { chainId: input.chainId, token, reason: intent.reason },
    });
    return { status: 'denied', reason: `Rejected: ${intent.reason}` };
  }

  // Policy evaluation with decoded intent
  const evaluation = ctx.policyEngine.evaluate({
    chainId: input.chainId,
    to: token,
    selector: intent.selector,
    amountWei: amount,
    intent,
  });

  if (!evaluation.allowed) {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Policy denied ERC20 transfer from token ${token} to ${to} on chain ${input.chainId}`,
      why: `Violations: ${evaluation.violations.join('; ')}`,
      result: 'denied',
      details: { chainId: input.chainId, token, to, amount: amount.toString(), violations: evaluation.violations },
    });
    return {
      status: 'denied',
      reason: `Policy denied: ${evaluation.violations.join('; ')}`,
      violations: evaluation.violations,
    };
  }

  // Dry-run: return decoded intent + policy evaluation without signing
  if (ctx.dryRun) {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Dry-run approved ERC20 transfer of ${token} to ${to} on chain ${input.chainId}`,
      why: 'Approved by decoder + policy (dry-run)',
      result: 'approved',
      details: { chainId: input.chainId, token, to, amount: amount.toString(), dryRun: true },
    });
    return {
      status: 'dry-run-approved',
      details: {
        protocol: intent.protocol,
        action: intent.action,
        chainId: input.chainId,
        token,
        to,
        amount: amount.toString(),
      },
    };
  }

  // RPC provider required for actual broadcast (after dry-run check)
  if (!ctx.rpcProvider) {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: 'RPC provider not available for ERC20 transfer',
      why: 'Configuration error: rpcProvider is required (pass --rpc-url)',
      result: 'error',
    });
    return { status: 'error', reason: 'RPC provider is required for send_erc20_transfer (pass --rpc-url)' };
  }

  // Signer required for actual broadcast (after dry-run check)
  if (!ctx.signer) {
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: 'Signer not available for ERC20 transfer',
      why: 'Configuration error: signer is required when dryRun is not enabled',
      result: 'error',
    });
    return { status: 'error', reason: 'Signer is required when dryRun is not enabled' };
  }

  try {
    const from = await ctx.signer.getAddress();
    const nonce = await ctx.rpcProvider.getTransactionCount(input.chainId, from);
    const gas = await ctx.rpcProvider.estimateGas(input.chainId, { from, to: token, data: calldata });
    const fees = await ctx.rpcProvider.estimateFeesPerGas(input.chainId);

    const signedTx = await ctx.signer.signTransaction({
      chainId: input.chainId,
      to: token,
      data: calldata,
      nonce,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      type: 'eip1559',
    });

    const txHash = await ctx.rpcProvider.sendRawTransaction(input.chainId, signedTx);
    const explorerUrl = buildExplorerUrl(input.chainId, txHash);

    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Sent ERC20 transfer: ${amount.toString()} of ${token} to ${to} on chain ${input.chainId}`,
      why: 'ERC20 transfer approved by decoder + policy',
      result: 'approved',
      details: { chainId: input.chainId, token, to, amount: amount.toString(), txHash, explorerUrl },
    });

    return {
      status: 'approved',
      data: JSON.stringify({ txHash, explorerUrl }),
      details: { txHash, explorerUrl },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.auditSink.log({
      service,
      action: 'send_erc20_transfer',
      who: ctx.caller,
      what: `Failed to send ERC20 transfer of ${token} to ${to} on chain ${input.chainId}`,
      why: 'Transfer error',
      result: 'error',
      details: { error: msg },
    });
    return { status: 'error', reason: `ERC20 transfer failed: ${msg}` };
  }
}
