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

// Policy V2
export { PolicyEngine } from './policy/engine.js';
export type {
  PolicyConfig,
  PolicyRequest,
  PolicyEvaluation,
  PolicyConfigV2,
  PolicyRequestV2,
  ProtocolPolicyConfig,
  ProtocolPolicyEvaluator,
} from './policy/types.js';

// Evaluators
export { erc20Evaluator } from './policy/evaluators/erc20.js';
