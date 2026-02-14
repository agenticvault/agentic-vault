import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSign } from '@/cli/commands/sign.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

function createMockCtx(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xaddr'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8signed'),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    dispatcher: {
      dispatch: vi.fn().mockReturnValue({
        protocol: 'erc20', action: 'approve', chainId: 1,
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', selector: '0x095ea7b3',
      }),
    },
    caller: 'cli',
    ...overrides,
  };
}

describe('runSign CLI command', () => {
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
    await expect(runSign(ctx, [])).rejects.toThrow('Usage:');
  });

  it('should output signed tx as JSON by default', async () => {
    const ctx = createMockCtx();
    await runSign(ctx, ['--chain-id', '1', '--to', '0xaddr', '--data', '0x095ea7b3']);
    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(output.status).toBe('approved');
    expect(output.signedTransaction).toBe('0x02f8signed');
  });

  it('should output raw signed tx with --output raw', async () => {
    const ctx = createMockCtx();
    await runSign(ctx, ['--chain-id', '1', '--to', '0xaddr', '--data', '0x095ea7b3', '--output', 'raw']);
    expect(stdoutWrite).toHaveBeenCalledWith('0x02f8signed\n');
  });

  it('should write to stderr and set exitCode on policy denial', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.policyEngine.evaluate).mockReturnValue({
      allowed: false,
      violations: ['limit exceeded'],
    });
    await runSign(ctx, ['--chain-id', '1', '--to', '0xaddr', '--data', '0x095ea7b3']);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Policy denied'));
    expect(process.exitCode).toBe(1);
  });
});
