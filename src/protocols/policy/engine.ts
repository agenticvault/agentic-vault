import {
  type PolicyConfigV2,
  type PolicyRequestV2,
  type PolicyEvaluation,
  type PolicyRequest,
  type ProtocolPolicyEvaluator,
} from './types.js';

export class PolicyEngine {
  private readonly config: PolicyConfigV2;
  private readonly evaluators: Map<string, ProtocolPolicyEvaluator>;

  constructor(config: PolicyConfigV2, evaluators?: ProtocolPolicyEvaluator[]) {
    this.config = config;
    this.evaluators = new Map(
      (evaluators ?? []).map((e) => [e.protocol, e]),
    );
  }

  evaluate(request: PolicyRequestV2): PolicyEvaluation {
    const violations: string[] = [];

    // -- V1 base checks (unchanged) --
    violations.push(...this.evaluateBase(request));

    // -- V2 intent-aware checks (fail-closed) --
    if (request.intent && request.intent.protocol !== 'unknown') {
      const evaluator = this.evaluators.get(request.intent.protocol);
      const protocolConfig = this.config.protocolPolicies?.[request.intent.protocol];

      if (!evaluator || !protocolConfig) {
        violations.push(
          `No policy evaluator/config registered for protocol '${request.intent.protocol}'`,
        );
      } else {
        violations.push(...evaluator.evaluate(request.intent, protocolConfig));
      }
    }

    return { allowed: violations.length === 0, violations };
  }

  private evaluateBase(request: PolicyRequest): string[] {
    const violations: string[] = [];

    // Check chainId whitelist
    if (!this.config.allowedChainIds.includes(request.chainId)) {
      violations.push(
        `chainId ${request.chainId} not in allowed list [${this.config.allowedChainIds.join(', ')}]`,
      );
    }

    // Check contract whitelist (case-insensitive)
    const normalizedTo = request.to.toLowerCase() as `0x${string}`;
    const normalizedContracts = this.config.allowedContracts.map(
      (c) => c.toLowerCase() as `0x${string}`,
    );
    if (!normalizedContracts.includes(normalizedTo)) {
      violations.push(
        `contract ${request.to} not in allowed list`,
      );
    }

    // Check selector whitelist (if selector provided)
    if (request.selector !== undefined) {
      const normalizedSelector = request.selector.toLowerCase() as `0x${string}`;
      const normalizedSelectors = this.config.allowedSelectors.map(
        (s) => s.toLowerCase() as `0x${string}`,
      );
      if (!normalizedSelectors.includes(normalizedSelector)) {
        violations.push(
          `selector ${request.selector} not in allowed list`,
        );
      }
    }

    // Check amount limit
    if (request.amountWei !== undefined) {
      if (request.amountWei > this.config.maxAmountWei) {
        violations.push(
          `amount ${request.amountWei} exceeds max ${this.config.maxAmountWei}`,
        );
      }
    }

    // Check deadline range
    if (request.deadline !== undefined) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const maxDeadline = nowSeconds + this.config.maxDeadlineSeconds;

      if (request.deadline < nowSeconds) {
        violations.push(
          `deadline ${request.deadline} is in the past (now: ${nowSeconds})`,
        );
      } else if (request.deadline > maxDeadline) {
        violations.push(
          `deadline ${request.deadline} exceeds max allowed (${maxDeadline})`,
        );
      }
    }

    return violations;
  }
}
