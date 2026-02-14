import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSignPermit } from '@/cli/commands/sign-permit.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';

const { MOCK_PERMIT_JSON } = vi.hoisted(() => ({
  MOCK_PERMIT_JSON: JSON.stringify({
    domain: {
      verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      chainId: 1,
      name: 'USDC',
      version: '1',
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner: '0xowner',
      spender: '0x1111111111111111111111111111111111111111',
      value: '1000000',
      nonce: 0,
      deadline: 1700000000,
    },
  }),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(MOCK_PERMIT_JSON),
}));

function createMockCtx(): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn(),
      signTransaction: vi.fn(),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
      healthCheck: vi.fn(),
    },
    policyEngine: { evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }) },
    auditSink: { log: vi.fn() },
    caller: 'cli',
  };
}

describe('runSignPermit CLI command', () => {
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

  it('should throw on missing args (no --file or flags)', async () => {
    const ctx = createMockCtx();
    await expect(runSignPermit(ctx, [])).rejects.toThrow('Usage:');
  });

  it('should output signature with legacy flags', async () => {
    const ctx = createMockCtx();
    await runSignPermit(ctx, [
      '--chain-id', '1',
      '--token', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '--spender', '0x1111111111111111111111111111111111111111',
      '--value', '1000000',
      '--deadline', '1700000000',
      '--payload', '/tmp/permit.json',
    ]);
    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(output.status).toBe('approved');
    expect(output.signature).toContain('"v":27');
  });

  it('should support --file mode with auto-extraction', async () => {
    const ctx = createMockCtx();
    await runSignPermit(ctx, ['--file', '/tmp/permit.json']);
    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(output.status).toBe('approved');
    expect(output.signature).toContain('"v":27');
  });

  it('should output raw signature with --output raw', async () => {
    const ctx = createMockCtx();
    await runSignPermit(ctx, [
      '--file', '/tmp/permit.json',
      '--output', 'raw',
    ]);
    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('"v":27');
  });
});
