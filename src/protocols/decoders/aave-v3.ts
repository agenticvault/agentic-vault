import { decodeFunctionData, type Address, type Hex } from 'viem';
import type { DecodedIntent, ProtocolDecoder } from '../types.js';
import { aaveV3PoolAbi } from '../catalog.js';

// supply(address,uint256,address,uint16)
const SUPPLY_SELECTOR = '0x617ba037';
// borrow(address,uint256,uint256,uint16,address)
const BORROW_SELECTOR = '0xa415bcad';
// repay(address,uint256,uint256,address)
const REPAY_SELECTOR = '0x573ade81';
// withdraw(address,uint256,address)
const WITHDRAW_SELECTOR = '0x69328dec';

export const aaveV3Decoder: ProtocolDecoder = {
  protocol: 'aave_v3',
  supportedSelectors: [
    SUPPLY_SELECTOR as Hex,
    BORROW_SELECTOR as Hex,
    REPAY_SELECTOR as Hex,
    WITHDRAW_SELECTOR as Hex,
  ],

  decode(chainId: number, to: Address, data: Hex): DecodedIntent {
    try {
      const { functionName, args } = decodeFunctionData({
        abi: aaveV3PoolAbi,
        data,
      });
      const selector = data.slice(0, 10).toLowerCase() as Hex;

      switch (functionName) {
        case 'supply':
          return {
            protocol: 'aave_v3',
            action: 'supply',
            chainId,
            to,
            selector,
            args: {
              asset: args[0] as Address,
              amount: args[1],
              onBehalfOf: args[2] as Address,
              referralCode: Number(args[3]),
            },
          };
        case 'borrow':
          return {
            protocol: 'aave_v3',
            action: 'borrow',
            chainId,
            to,
            selector,
            args: {
              asset: args[0] as Address,
              amount: args[1],
              interestRateMode: args[2],
              referralCode: Number(args[3]),
              onBehalfOf: args[4] as Address,
            },
          };
        case 'repay':
          return {
            protocol: 'aave_v3',
            action: 'repay',
            chainId,
            to,
            selector,
            args: {
              asset: args[0] as Address,
              amount: args[1],
              interestRateMode: args[2],
              onBehalfOf: args[3] as Address,
            },
          };
        case 'withdraw':
          return {
            protocol: 'aave_v3',
            action: 'withdraw',
            chainId,
            to,
            selector,
            args: {
              asset: args[0] as Address,
              amount: args[1],
              to: args[2] as Address,
            },
          };
        default:
          return {
            protocol: 'unknown',
            chainId,
            to,
            selector,
            rawData: data,
            reason: `Unsupported Aave V3 function: ${functionName}`,
          };
      }
    } catch {
      return {
        protocol: 'unknown',
        chainId,
        to,
        rawData: data,
        reason: 'Failed to decode Aave V3 calldata',
      };
    }
  },
};
