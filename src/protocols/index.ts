// Types
export type {
  DecodedIntent,
  ProtocolDecoder,
  Erc20ApproveIntent,
  Erc20TransferIntent,
  UniswapV3ExactInputSingleIntent,
  AaveV3SupplyIntent,
  AaveV3BorrowIntent,
  AaveV3RepayIntent,
  AaveV3WithdrawIntent,
  UnknownIntent,
} from './types.js';
export type { ContractEntry, RegistryConfig } from './registry.js';

// Classes
export { ProtocolRegistry, createDefaultRegistry } from './registry.js';
export { ProtocolDispatcher } from './dispatcher.js';

// Decoders
export { erc20Decoder } from './decoders/erc20.js';
export { uniswapV3Decoder } from './decoders/uniswap-v3.js';
export { aaveV3Decoder } from './decoders/aave-v3.js';

// Policy V2
export { PolicyEngine } from './policy/engine.js';
export { parsePolicyConfig, loadPolicyConfigFromFile } from './policy/loader.js';
export type {
  PolicyConfig,
  PolicyRequest,
  PolicyEvaluation,
  PolicyConfigV2,
  PolicyRequestV2,
  ProtocolPolicyConfig,
  ProtocolPolicyEvaluator,
} from './policy/types.js';

// Action Catalog
export { ACTION_CATALOG, listActions } from './catalog.js';
export type { ProtocolAction } from './catalog.js';

// Evaluators
export { erc20Evaluator } from './policy/evaluators/erc20.js';
export { uniswapV3Evaluator } from './policy/evaluators/uniswap-v3.js';
export { aaveV3Evaluator } from './policy/evaluators/aave-v3.js';

// Workflows
export {
  signDefiCall,
  signPermit,
  getAddress as getAddressWorkflow,
  healthCheck as healthCheckWorkflow,
  type WorkflowCaller,
  type AuditSink,
  type WorkflowSigner,
  type WorkflowPolicyEngine,
  type WorkflowDispatcher,
  type WorkflowDecodedIntent,
  type WorkflowContext,
  type WorkflowResult,
  type SignDefiCallInput,
  type SignPermitInput,
} from './workflows/index.js';
