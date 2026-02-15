import { readFileSync } from 'node:fs';
import type { PolicyConfigV2, ProtocolPolicyConfig } from './types.js';

/**
 * Parse a raw JSON object into a PolicyConfigV2.
 * Pure function — no I/O. Normalizes addresses and selectors to lowercase.
 */
export function parsePolicyConfig(raw: Record<string, unknown>): PolicyConfigV2 {
  let protocolPolicies: Record<string, ProtocolPolicyConfig> | undefined;
  if (raw.protocolPolicies && typeof raw.protocolPolicies === 'object') {
    protocolPolicies = {};
    for (const [protocol, config] of Object.entries(raw.protocolPolicies as Record<string, unknown>)) {
      const c = config as Record<string, unknown>;
      protocolPolicies[protocol] = {
        tokenAllowlist: (c.tokenAllowlist as string[] | undefined)?.map(
          (t: string) => t.toLowerCase(),
        ) as `0x${string}`[] | undefined,
        recipientAllowlist: (c.recipientAllowlist as string[] | undefined)?.map(
          (r: string) => r.toLowerCase(),
        ) as `0x${string}`[] | undefined,
        maxSlippageBps: c.maxSlippageBps as number | undefined,
        maxInterestRateMode: c.maxInterestRateMode as number | undefined,
        maxAllowanceWei:
          c.maxAllowanceWei != null
            ? BigInt(c.maxAllowanceWei as string)
            : undefined,
        maxAmountWei:
          c.maxAmountWei != null
            ? BigInt(c.maxAmountWei as string)
            : undefined,
      };
    }
  }

  return {
    allowedChainIds: (raw.allowedChainIds as number[]) ?? [],
    allowedContracts: ((raw.allowedContracts as string[]) ?? []).map(
      (c: string) => c.toLowerCase(),
    ) as `0x${string}`[],
    allowedSelectors: ((raw.allowedSelectors as string[]) ?? []).map(
      (s: string) => s.toLowerCase(),
    ) as `0x${string}`[],
    maxAmountWei: BigInt((raw.maxAmountWei as string) ?? '0'),
    maxDeadlineSeconds: (raw.maxDeadlineSeconds as number) ?? 0,
    protocolPolicies,
  };
}

/**
 * Load and parse a policy configuration from a JSON file.
 * Convenience wrapper around parsePolicyConfig for Node.js file I/O.
 */
export function loadPolicyConfigFromFile(path: string): PolicyConfigV2 {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return parsePolicyConfig(raw);
}
