import type { DecodedIntent } from '../../types.js';
import type { ProtocolPolicyConfig, ProtocolPolicyEvaluator } from '../types.js';

export const uniswapV3Evaluator: ProtocolPolicyEvaluator = {
  protocol: 'uniswap_v3',

  evaluate(intent: DecodedIntent, config: ProtocolPolicyConfig): string[] {
    if (intent.protocol !== 'uniswap_v3') {
      return [`uniswap_v3 evaluator received non-uniswap_v3 intent: ${intent.protocol}`];
    }

    const violations: string[] = [];
    const { action } = intent;

    switch (action) {
      case 'exactInputSingle': {
        // Check token allowlist (both tokenIn and tokenOut)
        if (config.tokenAllowlist && config.tokenAllowlist.length > 0) {
          const normalizedIn = intent.args.tokenIn.toLowerCase();
          const normalizedOut = intent.args.tokenOut.toLowerCase();
          const allowedSet = new Set(
            config.tokenAllowlist.map((t) => t.toLowerCase()),
          );

          if (!allowedSet.has(normalizedIn)) {
            violations.push(`tokenIn ${intent.args.tokenIn} not in tokenAllowlist`);
          }
          if (!allowedSet.has(normalizedOut)) {
            violations.push(`tokenOut ${intent.args.tokenOut} not in tokenAllowlist`);
          }
        }

        // Check recipient allowlist
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedRecipient = intent.args.recipient.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedRecipient,
          );
          if (!allowed) {
            violations.push(`recipient ${intent.args.recipient} not in recipientAllowlist`);
          }
        }

        // Check slippage protection: reject amountOutMinimum === 0 (infinite slippage)
        // True slippage % validation requires a price oracle (deferred).
        if (config.maxSlippageBps !== undefined) {
          if (intent.args.amountOutMinimum === 0n) {
            violations.push(
              'amountOutMinimum is 0 (no slippage protection); maxSlippageBps policy requires non-zero minimum output',
            );
          }
        }

        break;
      }
      default:
        violations.push(
          `Unknown uniswap_v3 action '${action as string}'; policy cannot evaluate`,
        );
    }

    return violations;
  },
};
