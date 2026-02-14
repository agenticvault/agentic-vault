import type { WorkflowResult } from '../../../protocols/index.js';

export interface McpToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export function toMcpResult(result: WorkflowResult): McpToolResult {
  switch (result.status) {
    case 'approved':
      return { content: [{ type: 'text' as const, text: result.data }] };
    case 'dry-run-approved': {
      const replacer = (_k: string, v: unknown) => typeof v === 'bigint' ? v.toString() : v;
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.details, replacer) }] };
    }
    case 'denied':
      return { content: [{ type: 'text' as const, text: result.reason }], isError: true };
    case 'error':
      return { content: [{ type: 'text' as const, text: result.reason }], isError: true };
  }
}
