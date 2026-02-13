#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  createSigningProvider,
  EvmSignerAdapter,
  type SignerAdapter,
} from '../index.js';
import {
  PolicyEngine,
  type PolicyConfigV2,
  type ProtocolPolicyConfig,
  erc20Evaluator,
} from '../protocols/index.js';
import { AuditLogger } from './audit/logger.js';
import { startStdioServer } from './mcp/server.js';

function parseArgs(argv: string[]): {
  keyId: string;
  region: string;
  expectedAddress?: string;
  unsafeRawSign: boolean;
  policyConfig?: string;
} {
  let keyId = '';
  let region = '';
  let expectedAddress: string | undefined;
  let unsafeRawSign = false;
  let policyConfig: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--key-id':
        keyId = argv[++i];
        break;
      case '--region':
        region = argv[++i];
        break;
      case '--expected-address':
        expectedAddress = argv[++i];
        break;
      case '--unsafe-raw-sign':
        unsafeRawSign = true;
        break;
      case '--policy-config':
        policyConfig = argv[++i];
        break;
      default:
        // Ignore unknown arguments
        break;
    }
  }

  if (!keyId) throw new Error('--key-id is required');
  if (!region) throw new Error('--region is required');

  return { keyId, region, expectedAddress, unsafeRawSign, policyConfig };
}

function loadPolicyConfig(path: string): PolicyConfigV2 {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));

  // Parse V2 protocolPolicies if present
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

const DEFAULT_POLICY: PolicyConfigV2 = {
  allowedChainIds: [],
  allowedContracts: [],
  allowedSelectors: [],
  maxAmountWei: 0n,
  maxDeadlineSeconds: 0,
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Create signer via factory
  const provider = createSigningProvider({
    provider: 'aws-kms',
    keyId: args.keyId,
    region: args.region,
  });
  const signer: SignerAdapter = new EvmSignerAdapter(provider, {
    expectedAddress: args.expectedAddress as `0x${string}` | undefined,
  });

  // Create policy engine
  const policyConfig = args.policyConfig
    ? loadPolicyConfig(args.policyConfig)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator]);

  // Create audit logger
  const auditLogger = new AuditLogger();

  // Start MCP stdio server
  await startStdioServer({
    signer,
    policyEngine,
    auditLogger,
    unsafeRawSign: args.unsafeRawSign,
  });
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'agentic-vault-mcp',
      level: 'error',
      message: error instanceof Error ? error.message : String(error),
    }) + '\n',
  );
  process.exit(1);
});
