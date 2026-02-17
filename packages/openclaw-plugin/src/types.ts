/** OpenClaw plugin API — structural contract for tool registration */
export interface OpenClawPluginApi {
  registerTool(name: string, config: OpenClawToolConfig, handler: OpenClawToolHandler): void;
}

/** Tool configuration for OpenClaw registration */
export interface OpenClawToolConfig {
  description: string;
  parameters?: Record<string, OpenClawParameter>;
  /** When true, the tool can be allowlisted by the agent (dual-gated) */
  optional?: boolean;
}

/** JSON Schema-compatible parameter definition (TypeBox compatible) */
export interface OpenClawParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

/** Tool handler function signature */
export type OpenClawToolHandler = (args: Record<string, unknown>) => Promise<OpenClawToolResult>;

/** Standard OpenClaw tool result format */
export interface OpenClawToolResult {
  content: { type: 'text'; text: string }[];
}

/** Plugin configuration provided by the OpenClaw host */
export interface OpenClawPluginConfig {
  keyId: string;
  region: string;
  expectedAddress?: string;
  policyConfigPath?: string;
  enableUnsafeRawSign?: boolean;
  rpcUrl?: string;
}
