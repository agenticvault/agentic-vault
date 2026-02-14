import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDryRun } from '@/cli/commands/dry-run.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

function createMockCtx(): WorkflowContext {
  return {
    signer: undefined,
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    dispatcher: {
      dispatch: vi.fn().mockReturnValue({
        protocol: 'erc20', action: 'approve', chainId: 1,
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', selector: '0x095ea7b3',
      }),
    },
    caller: 'cli',
    dryRun: true,
  };
}

describe('runDryRun CLI command', () => {
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

  it('should throw on missing args', async () => {
    const ctx = createMockCtx();
    await expect(runDryRun(ctx, [])).rejects.toThrow('Usage:');
  });

  it('should output dry-run details as JSON', async () => {
    const ctx = createMockCtx();
    await runDryRun(ctx, ['--chain-id', '1', '--to', '0xaddr', '--data', '0x095ea7b3']);
    expect(stdoutWrite).toHaveBeenCalled();
    const output = (stdoutWrite.mock.calls[0][0] as string);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('protocol', 'erc20');
  });

  it('should set exitCode on policy denial', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.policyEngine.evaluate).mockReturnValue({
      allowed: false,
      violations: ['not allowed'],
    });
    await runDryRun(ctx, ['--chain-id', '1', '--to', '0xaddr', '--data', '0x095ea7b3']);
    expect(process.exitCode).toBe(1);
  });
});
