import { describe, it, expect, vi, afterEach } from 'vitest';
import { encodeFunctionData } from 'viem';
import { runDecode } from '@/cli/commands/decode.js';

// Real ERC-20 ABI for test data generation
const erc20Abi = [
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const SPENDER = '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF';

describe('runDecode CLI command', () => {
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when required args are missing', async () => {
    await expect(runDecode([])).rejects.toThrow('Usage: agentic-vault decode');
    await expect(
      runDecode(['--chain-id', '1']),
    ).rejects.toThrow('Usage: agentic-vault decode');
  });

  it('should decode ERC-20 approve calldata', async () => {
    const calldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [SPENDER as `0x${string}`, 1000000n],
    });

    await runDecode(['--chain-id', '1', '--to', USDC, '--data', calldata]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(output.protocol).toBe('erc20');
    expect(output.action).toBe('approve');
    expect(output.args.spender).toBe(SPENDER);
    expect(output.args.amount).toBe('1000000');
  });

  it('should output unknown for unrecognized calldata', async () => {
    await runDecode([
      '--chain-id', '999',
      '--to', '0x0000000000000000000000000000000000000bad',
      '--data', '0xdeadbeef',
    ]);

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(output.protocol).toBe('unknown');
    expect(output.reason).toBeDefined();
  });

  it('should handle bigint serialization in output', async () => {
    const calldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [SPENDER as `0x${string}`, 999999999999999999n],
    });

    await runDecode(['--chain-id', '1', '--to', USDC, '--data', calldata]);

    const output = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    // BigInt should be serialized as string
    expect(output.args.amount).toBe('999999999999999999');
  });
});
