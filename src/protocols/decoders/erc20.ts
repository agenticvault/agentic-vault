import { decodeFunctionData, type Address, type Hex } from 'viem';
import type { DecodedIntent, ProtocolDecoder } from '../types.js';
import { erc20Abi } from '../catalog.js';

export const erc20Decoder: ProtocolDecoder = {
  protocol: 'erc20',
  supportedSelectors: ['0x095ea7b3', '0xa9059cbb'], // approve, transfer

  decode(chainId: number, to: Address, data: Hex): DecodedIntent {
    try {
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data });
      const selector = data.slice(0, 10).toLowerCase() as Hex;

      switch (functionName) {
        case 'approve':
          return {
            protocol: 'erc20',
            action: 'approve',
            chainId,
            to,
            selector,
            args: { spender: args[0], amount: args[1] },
          };
        case 'transfer':
          return {
            protocol: 'erc20',
            action: 'transfer',
            chainId,
            to,
            selector,
            args: { to: args[0], amount: args[1] },
          };
        default:
          return {
            protocol: 'unknown',
            chainId,
            to,
            selector,
            rawData: data,
            reason: `Unsupported ERC-20 function: ${functionName}`,
          };
      }
    } catch {
      return {
        protocol: 'unknown',
        chainId,
        to,
        rawData: data,
        reason: 'Failed to decode ERC-20 calldata',
      };
    }
  },
};
