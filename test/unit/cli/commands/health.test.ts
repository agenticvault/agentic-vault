import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runHealth } from '@/cli/commands/health.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

function createMockCtx(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn(),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    caller: 'cli',
    ...overrides,
  };
}

describe('runHealth CLI command', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    process.exitCode = undefined;
  });

  it('should output healthy JSON on success', async () => {
    const ctx = createMockCtx();
    await runHealth(ctx);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"healthy"'));
  });

  it('should set exitCode on error', async () => {
    const ctx = createMockCtx({ signer: undefined });
    await runHealth(ctx);
    expect(stderrWrite).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
