// ─── Backward-compatible exports (unchanged) ───
export { KmsSignerAdapter, type KmsSignerConfig } from './kms-signer.js';
export { AwsKmsClient, type IKmsClient, type KmsKeyMetadata } from './kms-client.js';
export type { SignerAdapter, SignatureComponents, SignTypedDataParams } from './types.js';
export {
  parseDerSignature,
  parseDerPublicKey,
  normalizeSignature,
  resolveRecoveryParam,
  publicToAddress,
} from './evm-signer.util.js';

// ─── Provider Abstraction Layer ───
export type {
  SigningProvider,
  SignatureBlob,
  PublicKeyBlob,
} from './core/signing-provider.js';
export { EvmSignerAdapter, type EvmSignerAdapterConfig } from './core/evm-signer-adapter.js';
export { AwsKmsProvider, type AwsKmsProviderConfig } from './providers/aws-kms/aws-kms-provider.js';
export {
  createSigningProvider,
  type SigningProviderConfig,
  type AwsKmsSigningProviderConfig,
} from './provider/factory.js';

// ─── Agentic MCP exports (subpath: @agenticvault/agentic-vault/agentic) ───
// Moved to separate subpath to avoid eagerly pulling Node-only MCP/stdio
// dependencies when consumers only need signing APIs.
// Import via: import { PolicyEngine } from '@agenticvault/agentic-vault/agentic'
export type { PolicyConfig, PolicyRequest, PolicyEvaluation } from './protocols/policy/types.js';
export type { AuditEntry } from './agentic/audit/types.js';
