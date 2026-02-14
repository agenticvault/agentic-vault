import { describe, it, expect } from 'vitest';
import { toMcpResult } from '@/agentic/mcp/tools/result-adapter.js';
import type { WorkflowResult } from '@/protocols/workflows/types.js';

describe('toMcpResult', () => {
  it('should convert approved result', () => {
    const result: WorkflowResult = { status: 'approved', data: '0xsigned' };
    const mcp = toMcpResult(result);
    expect(mcp.content).toEqual([{ type: 'text', text: '0xsigned' }]);
    expect(mcp.isError).toBeUndefined();
  });

  it('should convert dry-run-approved result to JSON', () => {
    const result: WorkflowResult = {
      status: 'dry-run-approved',
      details: { protocol: 'erc20', action: 'approve' },
    };
    const mcp = toMcpResult(result);
    expect(mcp.content).toEqual([{
      type: 'text',
      text: JSON.stringify({ protocol: 'erc20', action: 'approve' }),
    }]);
    expect(mcp.isError).toBeUndefined();
  });

  it('should convert denied result with isError', () => {
    const result: WorkflowResult = { status: 'denied', reason: 'Policy denied: limit' };
    const mcp = toMcpResult(result);
    expect(mcp.content).toEqual([{ type: 'text', text: 'Policy denied: limit' }]);
    expect(mcp.isError).toBe(true);
  });

  it('should handle BigInt values in dry-run-approved details', () => {
    const result: WorkflowResult = {
      status: 'dry-run-approved',
      details: {
        protocol: 'erc20',
        action: 'approve',
        intent: { args: { amount: 999999999999999999n } },
      },
    };
    const mcp = toMcpResult(result);
    // Should not throw — BigInt serialized as string
    const parsed = JSON.parse(mcp.content[0].text);
    expect(parsed.intent.args.amount).toBe('999999999999999999');
    expect(mcp.isError).toBeUndefined();
  });

  it('should convert error result with isError', () => {
    const result: WorkflowResult = { status: 'error', reason: 'Signing error: timeout' };
    const mcp = toMcpResult(result);
    expect(mcp.content).toEqual([{ type: 'text', text: 'Signing error: timeout' }]);
    expect(mcp.isError).toBe(true);
  });
});
