import { decodeFunctionData, type Address, type Hex } from 'viem';
import type { DecodedIntent, ProtocolDecoder } from '../types.js';
import { uniswapV3SwapRouterAbi } from '../catalog.js';

// exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))
const EXACT_INPUT_SINGLE_SELECTOR = '0x04e45aaf';

export const uniswapV3Decoder: ProtocolDecoder = {
  protocol: 'uniswap_v3',
  supportedSelectors: [EXACT_INPUT_SINGLE_SELECTOR as Hex],

  decode(chainId: number, to: Address, data: Hex): DecodedIntent {
    try {
      const { functionName, args } = decodeFunctionData({
        abi: uniswapV3SwapRouterAbi,
        data,
      });
      const selector = data.slice(0, 10).toLowerCase() as Hex;

      switch (functionName) {
        case 'exactInputSingle': {
          const params = args[0];
          return {
            protocol: 'uniswap_v3',
            action: 'exactInputSingle',
            chainId,
            to,
            selector,
            args: {
              tokenIn: params.tokenIn as Address,
              tokenOut: params.tokenOut as Address,
              fee: Number(params.fee),
              recipient: params.recipient as Address,
              amountIn: params.amountIn,
              amountOutMinimum: params.amountOutMinimum,
              sqrtPriceLimitX96: params.sqrtPriceLimitX96,
            },
          };
        }
        default:
          return {
            protocol: 'unknown',
            chainId,
            to,
            selector,
            rawData: data,
            reason: `Unsupported Uniswap V3 function: ${functionName}`,
          };
      }
    } catch {
      return {
        protocol: 'unknown',
        chainId,
        to,
        rawData: data,
        reason: 'Failed to decode Uniswap V3 calldata',
      };
    }
  },
};
