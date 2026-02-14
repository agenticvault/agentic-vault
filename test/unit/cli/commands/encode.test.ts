import { describe, it, expect, vi, afterEach } from 'vitest';
import { runEncode } from '@/cli/commands/encode.js';

describe('runEncode CLI command', () => {
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when no action key is provided', async () => {
    await expect(runEncode([])).rejects.toThrow('Usage: agentic-vault encode');
  });

  it('should throw when action key starts with --', async () => {
    await expect(runEncode(['--spender', '0x1234'])).rejects.toThrow(
      'Usage: agentic-vault encode',
    );
  });

  it('should throw for unknown action key', async () => {
    await expect(runEncode(['unknown:action'])).rejects.toThrow('Unknown action: unknown:action');
    await expect(runEncode(['unknown:action'])).rejects.toThrow('Available actions:');
  });

  it('should throw when required parameters are missing', async () => {
    await expect(
      runEncode(['erc20:approve', '--spender', '0x1234567890123456789012345678901234567890']),
    ).rejects.toThrow('Missing required parameters: --amount');
  });

  it('should encode erc20:approve with raw output', async () => {
    await runEncode([
      'erc20:approve',
      '--output', 'raw',
      '--spender', '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      '--amount', '1000000',
    ]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output.trim()).toMatch(/^0x095ea7b3/);
    expect(output.trim()).toHaveLength(2 + 8 + 64 * 2);
  });

  it('should encode erc20:approve with json output by default', async () => {
    await runEncode([
      'erc20:approve',
      '--spender', '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      '--amount', '1000000',
    ]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(parsed.action).toBe('erc20:approve');
    expect(parsed.calldata).toMatch(/^0x095ea7b3/);
  });

  it('should encode erc20:transfer correctly', async () => {
    await runEncode([
      'erc20:transfer',
      '--output', 'raw',
      '--to', '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      '--amount', '500',
    ]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output.trim()).toMatch(/^0xa9059cbb/);
  });

  it('should encode uniswap_v3:exactInputSingle correctly', async () => {
    await runEncode([
      'uniswap_v3:exactInputSingle',
      '--output', 'raw',
      '--tokenIn', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      '--tokenOut', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      '--fee', '3000',
      '--recipient', '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      '--amountIn', '500000000000000000',
      '--amountOutMinimum', '900000000',
      '--sqrtPriceLimitX96', '0',
    ]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output.trim()).toMatch(/^0x04e45aaf/);
  });

  it('should encode with human-readable output', async () => {
    await runEncode([
      'erc20:approve',
      '--output', 'human',
      '--spender', '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      '--amount', '1000000',
    ]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('Encoded Calldata');
    expect(output).toContain('erc20:approve');
    expect(output).toContain('0x095ea7b3');
  });

  it('should throw when missing value for a flag', async () => {
    await expect(
      runEncode(['erc20:approve', '--spender']),
    ).rejects.toThrow('Missing value for --spender');
  });
});
