import type { Hex } from 'viem';

/**
 * Protocol Action Catalog — shared ABI metadata for encode/decode.
 * Single source of truth: ABIs live here, decoders import from here.
 */

// -- ABI fragments (same as used by decoders, exported for encoder) --

export const erc20ApproveAbi = {
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
} as const;

export const erc20TransferAbi = {
  name: 'transfer',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
} as const;

export const uniswapV3ExactInputSingleAbi = {
  name: 'exactInputSingle',
  type: 'function',
  stateMutability: 'payable',
  inputs: [
    {
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    },
  ],
  outputs: [{ name: 'amountOut', type: 'uint256' }],
} as const;

// -- Combined ABI arrays for decoders --

export const erc20Abi = [erc20ApproveAbi, erc20TransferAbi] as const;

export const uniswapV3SwapRouterAbi = [uniswapV3ExactInputSingleAbi] as const;

// -- Action Catalog --

export interface ProtocolAction {
  readonly protocol: string;
  readonly action: string;
  readonly selector: Hex;
  readonly abi: readonly [typeof erc20ApproveAbi | typeof erc20TransferAbi | typeof uniswapV3ExactInputSingleAbi];
  readonly paramNames: readonly string[];
  readonly paramTypes: readonly string[];
}

export const ACTION_CATALOG: Readonly<Record<string, ProtocolAction>> = {
  'erc20:approve': {
    protocol: 'erc20',
    action: 'approve',
    selector: '0x095ea7b3',
    abi: [erc20ApproveAbi],
    paramNames: ['spender', 'amount'],
    paramTypes: ['address', 'uint256'],
  },
  'erc20:transfer': {
    protocol: 'erc20',
    action: 'transfer',
    selector: '0xa9059cbb',
    abi: [erc20TransferAbi],
    paramNames: ['to', 'amount'],
    paramTypes: ['address', 'uint256'],
  },
  'uniswap_v3:exactInputSingle': {
    protocol: 'uniswap_v3',
    action: 'exactInputSingle',
    selector: '0x04e45aaf',
    abi: [uniswapV3ExactInputSingleAbi],
    paramNames: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96'],
    paramTypes: ['address', 'address', 'uint24', 'address', 'uint256', 'uint256', 'uint160'],
  },
};

/** List all available action keys for help/error messages */
export function listActions(): string[] {
  return Object.keys(ACTION_CATALOG);
}
