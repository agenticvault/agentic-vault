import { type CliGlobalArgs } from '../context.js';
import {
  createSigningProvider,
  EvmSignerAdapter,
  type SignerAdapter,
} from '../../index.js';
import {
  PolicyEngine,
  type PolicyConfigV2,
  type ProtocolPolicyConfig,
  erc20Evaluator,
  uniswapV3Evaluator,
} from '../../protocols/index.js';
import { AuditLogger, startStdioServer } from '../../agentic/index.js';
import { readFileSync } from 'node:fs';

/**
 * Runs the MCP stdio server.
 * Accepts an additional --unsafe-raw-sign flag specific to MCP mode.
 */
export async function runMcp(args: CliGlobalArgs, argv: string[]): Promise<void> {
  let unsafeRawSign = false;
  for (const arg of argv) {
    if (arg === '--unsafe-raw-sign') unsafeRawSign = true;
  }

  const provider = createSigningProvider({
    provider: 'aws-kms',
    keyId: args.keyId,
    region: args.region,
  });
  const signer: SignerAdapter = new EvmSignerAdapter(provider, {
    expectedAddress: args.expectedAddress as `0x${string}` | undefined,
  });

  const policyConfig = args.policyConfig
    ? loadMcpPolicyConfig(args.policyConfig)
    : DEFAULT_MCP_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator]);

  await startStdioServer({
    signer,
    policyEngine,
    auditLogger: new AuditLogger(),
    unsafeRawSign,
  });
}

const DEFAULT_MCP_POLICY: PolicyConfigV2 = {
  allowedChainIds: [],
  allowedContracts: [],
  allowedSelectors: [],
  maxAmountWei: 0n,
  maxDeadlineSeconds: 0,
};

function loadMcpPolicyConfig(path: string): PolicyConfigV2 {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));

  let protocolPolicies: Record<string, ProtocolPolicyConfig> | undefined;
  if (raw.protocolPolicies && typeof raw.protocolPolicies === 'object') {
    protocolPolicies = {};
    for (const [protocol, config] of Object.entries(raw.protocolPolicies)) {
      const c = config as Record<string, unknown>;
      protocolPolicies[protocol] = {
        tokenAllowlist: (c.tokenAllowlist as string[] | undefined)?.map((t: string) => t.toLowerCase()) as `0x${string}`[] | undefined,
        recipientAllowlist: (c.recipientAllowlist as string[] | undefined)?.map((r: string) => r.toLowerCase()) as `0x${string}`[] | undefined,
        maxSlippageBps: c.maxSlippageBps as number | undefined,
        maxInterestRateMode: c.maxInterestRateMode as number | undefined,
        maxAllowanceWei: c.maxAllowanceWei != null ? BigInt(c.maxAllowanceWei as string) : undefined,
      };
    }
  }

  return {
    allowedChainIds: raw.allowedChainIds ?? [],
    allowedContracts: (raw.allowedContracts ?? []).map((c: string) => c.toLowerCase()),
    allowedSelectors: (raw.allowedSelectors ?? []).map((s: string) => s.toLowerCase()),
    maxAmountWei: BigInt(raw.maxAmountWei ?? '0'),
    maxDeadlineSeconds: raw.maxDeadlineSeconds ?? 0,
    protocolPolicies,
  };
}
