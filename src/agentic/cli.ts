#!/usr/bin/env node

import {
  createSigningProvider,
  EvmSignerAdapter,
  ViemRpcProvider,
  type SignerAdapter,
} from '../index.js';
import {
  PolicyEngine,
  type PolicyConfigV2,
  erc20Evaluator,
  uniswapV3Evaluator,
  aaveV3Evaluator,
  loadPolicyConfigFromFile,
} from '../protocols/index.js';
import { AuditLogger } from './audit/logger.js';
import { startStdioServer } from './mcp/server.js';

export function parseArgs(argv: string[]): {
  keyId: string;
  region: string;
  expectedAddress?: string;
  unsafeRawSign: boolean;
  policyConfig?: string;
  rpcUrl?: string;
} {
  let keyId = '';
  let region = '';
  let expectedAddress: string | undefined;
  let unsafeRawSign = false;
  let policyConfig: string | undefined;
  let rpcUrl: string | undefined;

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
      case '--rpc-url':
        rpcUrl = argv[++i];
        break;
      default:
        // Ignore unknown arguments
        break;
    }
  }

  if (!keyId) keyId = process.env.VAULT_KEY_ID ?? '';
  if (!region) region = process.env.VAULT_REGION ?? '';
  if (!rpcUrl) rpcUrl = process.env.VAULT_RPC_URL;

  if (!keyId) throw new Error('--key-id or VAULT_KEY_ID environment variable is required');
  if (!region) throw new Error('--region or VAULT_REGION environment variable is required');

  return { keyId, region, expectedAddress, unsafeRawSign, policyConfig, rpcUrl };
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
    ? loadPolicyConfigFromFile(args.policyConfig)
    : DEFAULT_POLICY;
  const policyEngine = new PolicyEngine(policyConfig, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);

  // Create audit logger
  const auditLogger = new AuditLogger();

  // Create RPC provider (optional — enables get_balance, send_transfer, send_erc20_transfer)
  const rpcProvider = new ViemRpcProvider({ rpcUrl: args.rpcUrl });

  // Start MCP stdio server
  await startStdioServer({
    signer,
    policyEngine,
    auditLogger,
    rpcProvider,
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
