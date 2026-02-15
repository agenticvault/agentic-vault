import { type CliGlobalArgs } from '../context.js';
import {
  createSigningProvider,
  EvmSignerAdapter,
  type SignerAdapter,
} from '../../index.js';
import {
  PolicyEngine,
  type PolicyConfigV2,
  erc20Evaluator,
  uniswapV3Evaluator,
  aaveV3Evaluator,
  loadPolicyConfigFromFile,
} from '../../protocols/index.js';
import { AuditLogger, startStdioServer } from '../../agentic/index.js';

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
    ? loadPolicyConfigFromFile(args.policyConfig)
    : DEFAULT_MCP_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);

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

