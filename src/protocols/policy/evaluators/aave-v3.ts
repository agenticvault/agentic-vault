import type { DecodedIntent } from '../../types.js';
import type { ProtocolPolicyConfig, ProtocolPolicyEvaluator } from '../types.js';

export const aaveV3Evaluator: ProtocolPolicyEvaluator = {
  protocol: 'aave_v3',

  evaluate(intent: DecodedIntent, config: ProtocolPolicyConfig): string[] {
    if (intent.protocol !== 'aave_v3') {
      return [`aave_v3 evaluator received non-aave_v3 intent: ${intent.protocol}`];
    }

    const violations: string[] = [];
    const { action } = intent;

    switch (action) {
      case 'supply': {
        // Token allowlist: check asset (the reserve token, not intent.to which is the Pool)
        if (config.tokenAllowlist && config.tokenAllowlist.length > 0) {
          const normalizedAsset = intent.args.asset.toLowerCase();
          const allowed = config.tokenAllowlist.some(
            (t) => t.toLowerCase() === normalizedAsset,
          );
          if (!allowed) {
            violations.push(`asset ${intent.args.asset} not in tokenAllowlist`);
          }
        }

        // Recipient allowlist: check onBehalfOf
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedRecipient = intent.args.onBehalfOf.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedRecipient,
          );
          if (!allowed) {
            violations.push(`onBehalfOf ${intent.args.onBehalfOf} not in recipientAllowlist`);
          }
        }

        // maxAmountWei
        if (config.maxAmountWei !== undefined && intent.args.amount > config.maxAmountWei) {
          violations.push(
            `amount ${intent.args.amount} exceeds maxAmountWei ${config.maxAmountWei}`,
          );
        }

        break;
      }

      case 'borrow': {
        // Token allowlist
        if (config.tokenAllowlist && config.tokenAllowlist.length > 0) {
          const normalizedAsset = intent.args.asset.toLowerCase();
          const allowed = config.tokenAllowlist.some(
            (t) => t.toLowerCase() === normalizedAsset,
          );
          if (!allowed) {
            violations.push(`asset ${intent.args.asset} not in tokenAllowlist`);
          }
        }

        // Recipient allowlist: check onBehalfOf
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedRecipient = intent.args.onBehalfOf.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedRecipient,
          );
          if (!allowed) {
            violations.push(`onBehalfOf ${intent.args.onBehalfOf} not in recipientAllowlist`);
          }
        }

        // maxInterestRateMode
        if (
          config.maxInterestRateMode !== undefined &&
          Number(intent.args.interestRateMode) > config.maxInterestRateMode
        ) {
          violations.push(
            `interestRateMode ${intent.args.interestRateMode} exceeds maxInterestRateMode ${config.maxInterestRateMode}`,
          );
        }

        // maxAmountWei
        if (config.maxAmountWei !== undefined && intent.args.amount > config.maxAmountWei) {
          violations.push(
            `amount ${intent.args.amount} exceeds maxAmountWei ${config.maxAmountWei}`,
          );
        }

        break;
      }

      case 'repay': {
        // Token allowlist
        if (config.tokenAllowlist && config.tokenAllowlist.length > 0) {
          const normalizedAsset = intent.args.asset.toLowerCase();
          const allowed = config.tokenAllowlist.some(
            (t) => t.toLowerCase() === normalizedAsset,
          );
          if (!allowed) {
            violations.push(`asset ${intent.args.asset} not in tokenAllowlist`);
          }
        }

        // Recipient allowlist: check onBehalfOf
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedRecipient = intent.args.onBehalfOf.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedRecipient,
          );
          if (!allowed) {
            violations.push(`onBehalfOf ${intent.args.onBehalfOf} not in recipientAllowlist`);
          }
        }

        // maxInterestRateMode
        if (
          config.maxInterestRateMode !== undefined &&
          Number(intent.args.interestRateMode) > config.maxInterestRateMode
        ) {
          violations.push(
            `interestRateMode ${intent.args.interestRateMode} exceeds maxInterestRateMode ${config.maxInterestRateMode}`,
          );
        }

        // maxAmountWei
        if (config.maxAmountWei !== undefined && intent.args.amount > config.maxAmountWei) {
          violations.push(
            `amount ${intent.args.amount} exceeds maxAmountWei ${config.maxAmountWei}`,
          );
        }

        break;
      }

      case 'withdraw': {
        // Token allowlist
        if (config.tokenAllowlist && config.tokenAllowlist.length > 0) {
          const normalizedAsset = intent.args.asset.toLowerCase();
          const allowed = config.tokenAllowlist.some(
            (t) => t.toLowerCase() === normalizedAsset,
          );
          if (!allowed) {
            violations.push(`asset ${intent.args.asset} not in tokenAllowlist`);
          }
        }

        // Recipient allowlist: check to
        if (config.recipientAllowlist && config.recipientAllowlist.length > 0) {
          const normalizedTo = intent.args.to.toLowerCase();
          const allowed = config.recipientAllowlist.some(
            (r) => r.toLowerCase() === normalizedTo,
          );
          if (!allowed) {
            violations.push(`to ${intent.args.to} not in recipientAllowlist`);
          }
        }

        // maxAmountWei
        if (config.maxAmountWei !== undefined && intent.args.amount > config.maxAmountWei) {
          violations.push(
            `amount ${intent.args.amount} exceeds maxAmountWei ${config.maxAmountWei}`,
          );
        }

        break;
      }

      default:
        violations.push(
          `Unknown aave_v3 action '${action as string}'; policy cannot evaluate`,
        );
    }

    return violations;
  },
};
