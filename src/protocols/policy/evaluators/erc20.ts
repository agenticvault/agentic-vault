import type { DecodedIntent } from '../../types.js';
import type { ProtocolPolicyConfig, ProtocolPolicyEvaluator } from '../types.js';

export const erc20Evaluator: ProtocolPolicyEvaluator = {
  protocol: 'erc20',

  evaluate(intent: DecodedIntent, config: ProtocolPolicyConfig): string[] {
    if (intent.protocol !== 'erc20') {
      return [`erc20 evaluator received non-erc20 intent: ${intent.protocol}`];
    }

    const violations: string[] = [];

    // Check token (contract address) allowlist
    if (config.tokenAllowlist && config.tokenAllowlist.length > 0) {
      const normalizedToken = intent.to.toLowerCase();
      const allowed = config.tokenAllowlist.some(
        (t) => t.toLowerCase() === normalizedToken,
      );
      if (!allowed) {
        violations.push(`token ${intent.to} not in tokenAllowlist`);
      }
    }

    switch (intent.action) {
      case 'approve': {
        // Check spender allowlist
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedSpender = intent.args.spender.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedSpender,
          );
          if (!allowed) {
            violations.push(`spender ${intent.args.spender} not in recipientAllowlist`);
          }
        }

        // Check allowance cap
        if (config.maxAllowanceWei !== undefined) {
          if (intent.args.amount > config.maxAllowanceWei) {
            violations.push(
              `approve amount ${intent.args.amount} exceeds maxAllowanceWei ${config.maxAllowanceWei}`,
            );
          }
        }
        break;
      }

      case 'transfer': {
        // Check recipient allowlist
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedRecipient = intent.args.to.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedRecipient,
          );
          if (!allowed) {
            violations.push(`recipient ${intent.args.to} not in recipientAllowlist`);
          }
        }

        // Check transfer amount cap
        if (config.maxAllowanceWei !== undefined) {
          if (intent.args.amount > config.maxAllowanceWei) {
            violations.push(
              `transfer amount ${intent.args.amount} exceeds maxAllowanceWei ${config.maxAllowanceWei}`,
            );
          }
        }
        break;
      }
    }

    return violations;
  },
};
