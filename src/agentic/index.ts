// ─── Policy Engine (deprecated — use @sd0xdev/agentic-vault/protocols) ───
export { PolicyEngine } from '../protocols/index.js';
export type {
  PolicyConfig,
  PolicyRequest,
  PolicyEvaluation,
  PolicyConfigV2,
  PolicyRequestV2,
  ProtocolPolicyConfig,
  ProtocolPolicyEvaluator,
} from '../protocols/index.js';

// ─── Audit Logger ───
export { AuditLogger } from './audit/logger.js';
export type { AuditEntry } from './audit/types.js';

// ─── MCP Server ───
export { createMcpServer, startStdioServer } from './mcp/server.js';
