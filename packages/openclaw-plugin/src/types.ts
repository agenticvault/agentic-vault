export type {
  OpenClawPluginApi,
  AnyAgentTool,
} from 'openclaw/plugin-sdk';

/** Vault-specific config shape (read from api.pluginConfig) */
export interface OpenClawPluginConfig {
  keyId: string;
  region: string;
  expectedAddress?: string;
  policyConfigPath?: string;
  enableUnsafeRawSign?: boolean;
  rpcUrl?: string;
}
