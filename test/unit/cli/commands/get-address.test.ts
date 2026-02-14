import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runGetAddress } from '@/cli/commands/get-address.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

function createMockCtx(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    caller: 'cli',
    ...overrides,
  };
}

describe('runGetAddress CLI command', () => {
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

  it('should output address as JSON by default', async () => {
    const ctx = createMockCtx();
    await runGetAddress(ctx);
    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(output.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });

  it('should output raw address with raw format', async () => {
    const ctx = createMockCtx();
    await runGetAddress(ctx, 'raw');
    expect(stdoutWrite).toHaveBeenCalledWith('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\n');
  });

  it('should set exitCode on error', async () => {
    const ctx = createMockCtx({ signer: undefined });
    await runGetAddress(ctx);
    expect(stderrWrite).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
