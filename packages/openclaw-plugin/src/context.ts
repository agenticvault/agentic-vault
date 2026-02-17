import {
  createSigningProvider,
  EvmSignerAdapter,
  ViemRpcProvider,
} from '@agenticvault/agentic-vault';
import {
  PolicyEngine,
  erc20Evaluator,
  uniswapV3Evaluator,
  aaveV3Evaluator,
  ProtocolDispatcher,
  createDefaultRegistry,
  loadPolicyConfigFromFile,
  type WorkflowContext,
  type AuditSink,
  type PolicyConfigV2,
} from '@agenticvault/agentic-vault/protocols';
import { type OpenClawPluginConfig } from './types.js';

const DEFAULT_POLICY: PolicyConfigV2 = {
  allowedChainIds: [],
  allowedContracts: [],
  allowedSelectors: [],
  maxAmountWei: 0n,
  maxDeadlineSeconds: 0,
};

/**
 * Build a WorkflowContext from OpenClaw plugin configuration.
 * Returns a new instance on each call — caller manages lifecycle.
 */
export function buildContext(config: OpenClawPluginConfig): WorkflowContext {
  if (!config.keyId) {
    throw new Error('OpenClaw plugin config: keyId is required');
  }
  if (!config.region) {
    throw new Error('OpenClaw plugin config: region is required');
  }

  const provider = createSigningProvider({
    provider: 'aws-kms',
    keyId: config.keyId,
    region: config.region,
  });
  const signer = new EvmSignerAdapter(provider, {
    expectedAddress: config.expectedAddress as `0x${string}` | undefined,
  });

  const policyConfig = config.policyConfigPath
    ? loadPolicyConfigFromFile(config.policyConfigPath)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [
    erc20Evaluator,
    uniswapV3Evaluator,
    aaveV3Evaluator,
  ]);

  const dispatcher = new ProtocolDispatcher(createDefaultRegistry());
  const auditSink = createAuditSink();

  const rpcProvider = config.rpcUrl
    ? new ViemRpcProvider({ rpcUrl: config.rpcUrl })
    : undefined;

  return {
    signer,
    policyEngine,
    auditSink,
    dispatcher,
    rpcProvider,
    caller: 'openclaw',
    service: 'agentic-vault-openclaw',
  };
}

/** Simple AuditSink implementation — writes JSON to stderr */
function createAuditSink(): AuditSink {
  return {
    log(entry) {
      const full = {
        timestamp: new Date().toISOString(),
        traceId: crypto.randomUUID(),
        ...entry,
      };
      process.stderr.write(JSON.stringify(full) + '\n');
      return full;
    },
  };
}
