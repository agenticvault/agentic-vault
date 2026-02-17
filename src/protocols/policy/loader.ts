import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { PolicyConfigV2 } from './types.js';

// ─── Zod schema for runtime validation ───

const zodHexString = z.string().refine(
  (v) => /^0x[0-9a-fA-F]*$/.test(v),
  { message: 'Must be a 0x-prefixed hex string' },
);

const zodBigIntString = z.union([z.string(), z.number().safe()]).transform(
  (v, ctx) => {
    try {
      return BigInt(v);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a BigInt-compatible value',
      });
      return z.NEVER;
    }
  },
);

const protocolPolicyConfigSchema = z.object({
  tokenAllowlist: z.array(zodHexString).optional(),
  recipientAllowlist: z.array(zodHexString).optional(),
  maxSlippageBps: z.number().int().nonnegative().optional(),
  maxInterestRateMode: z.number().int().nonnegative().optional(),
  maxAllowanceWei: zodBigIntString.optional(),
  maxAmountWei: zodBigIntString.optional(),
}).passthrough();

const policyConfigV2Schema = z.object({
  allowedChainIds: z.array(z.number().int()).default([]),
  allowedContracts: z.array(zodHexString).default([]),
  allowedSelectors: z.array(zodHexString).default([]),
  maxAmountWei: zodBigIntString.default(0n),
  maxDeadlineSeconds: z.number().int().nonnegative().default(0),
  protocolPolicies: z.record(z.string(), protocolPolicyConfigSchema).optional(),
}).passthrough();

/**
 * Parse a raw JSON object into a PolicyConfigV2.
 * Pure function — no I/O. Validates with Zod, normalizes addresses and selectors to lowercase.
 */
export function parsePolicyConfig(raw: Record<string, unknown>): PolicyConfigV2 {
  const result = policyConfigV2Schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid policy configuration: ${messages}`);
  }
  const parsed = result.data;

  return {
    ...parsed,
    allowedContracts: parsed.allowedContracts.map(
      (c: string) => c.toLowerCase(),
    ) as `0x${string}`[],
    allowedSelectors: parsed.allowedSelectors.map(
      (s: string) => s.toLowerCase(),
    ) as `0x${string}`[],
    protocolPolicies: parsed.protocolPolicies
      ? Object.fromEntries(
          Object.entries(parsed.protocolPolicies).map(([protocol, config]) => [
            protocol,
            {
              ...config,
              tokenAllowlist: config.tokenAllowlist?.map(
                (t: string) => t.toLowerCase(),
              ) as `0x${string}`[] | undefined,
              recipientAllowlist: config.recipientAllowlist?.map(
                (r: string) => r.toLowerCase(),
              ) as `0x${string}`[] | undefined,
            },
          ]),
        )
      : undefined,
  } as PolicyConfigV2;
}

/**
 * Load and parse a policy configuration from a JSON file.
 * Convenience wrapper around parsePolicyConfig for Node.js file I/O.
 */
export function loadPolicyConfigFromFile(path: string): PolicyConfigV2 {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return parsePolicyConfig(raw);
}
