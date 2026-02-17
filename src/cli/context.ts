import {
  createSigningProvider,
  EvmSignerAdapter,
  AuditLogger,
  type SignerAdapter,
} from '../index.js';
import {
  PolicyEngine,
  type PolicyConfigV2,
  erc20Evaluator,
  uniswapV3Evaluator,
  aaveV3Evaluator,
  ProtocolDispatcher,
  createDefaultRegistry,
  loadPolicyConfigFromFile,
  type WorkflowContext,
} from '../protocols/index.js';

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

  if (!keyId) keyId = process.env.VAULT_KEY_ID ?? '';
  if (!region) region = process.env.VAULT_REGION ?? '';

  if (!keyId) throw new Error('--key-id or VAULT_KEY_ID environment variable is required');
  if (!region) throw new Error('--region or VAULT_REGION environment variable is required');

  return { keyId, region, expectedAddress, policyConfig };
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
    ? loadPolicyConfigFromFile(args.policyConfig)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);

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
    ? loadPolicyConfigFromFile(args.policyConfig)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);

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
