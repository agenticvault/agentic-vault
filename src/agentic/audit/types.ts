export interface AuditEntry {
  timestamp: string; // ISO 8601
  traceId: string; // UUID v4
  service: string; // 'agentic-vault-mcp'
  action: string; // tool name (e.g., 'sign_swap')
  who: string; // caller identity (agent/session)
  what: string; // human-readable description
  why: string; // reason/context
  result: 'approved' | 'denied' | 'error';
  details?: Record<string, unknown>;
}
