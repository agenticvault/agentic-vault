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
  uniswapV3Evaluator,
  ProtocolDispatcher,
  createDefaultRegistry,
  type WorkflowContext,
} from '../protocols/index.js';
import { AuditLogger } from '../agentic/index.js';

export interface CliGlobalArgs {
  keyId: string;
  region: string;
  expectedAddress?: string;
  policyConfig?: string;
}

const DEFAULT_POLICY: PolicyConfigV2 = {
  allowedChainIds: [],
  allowedContracts: [],
  allowedSelectors: [],
  maxAmountWei: 0n,
  maxDeadlineSeconds: 0,
};

export function parseGlobalArgs(argv: string[]): CliGlobalArgs {
  let keyId = '';
  let region = '';
  let expectedAddress: string | undefined;
  let policyConfig: string | undefined;

  for (let i = 0; i < argv.length; i++) {
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
      case '--policy-config':
        policyConfig = argv[++i];
        break;
      default:
        break;
    }
  }

  if (!keyId) throw new Error('--key-id is required');
  if (!region) throw new Error('--region is required');

  return { keyId, region, expectedAddress, policyConfig };
}

function loadPolicyConfig(path: string): PolicyConfigV2 {
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

function createDispatcher(): ProtocolDispatcher {
  return new ProtocolDispatcher(createDefaultRegistry());
}

export function buildWorkflowContext(args: CliGlobalArgs): WorkflowContext {
  const provider = createSigningProvider({
    provider: 'aws-kms',
    keyId: args.keyId,
    region: args.region,
  });
  const signer: SignerAdapter = new EvmSignerAdapter(provider, {
    expectedAddress: args.expectedAddress as `0x${string}` | undefined,
  });

  const policyConfig = args.policyConfig
    ? loadPolicyConfig(args.policyConfig)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator]);

  return {
    signer,
    policyEngine,
    auditSink: new AuditLogger(),
    dispatcher: createDispatcher(),
    caller: 'cli',
    service: 'agentic-vault-cli',
  };
}

export function buildDryRunContext(args?: Partial<CliGlobalArgs>): WorkflowContext {
  const policyConfig = args?.policyConfig
    ? loadPolicyConfig(args.policyConfig)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator]);

  return {
    signer: undefined,
    policyEngine,
    auditSink: new AuditLogger(),
    dispatcher: createDispatcher(),
    caller: 'cli',
    service: 'agentic-vault-cli',
    dryRun: true,
  };
}
