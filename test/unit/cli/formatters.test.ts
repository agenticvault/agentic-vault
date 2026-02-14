import { describe, it, expect } from 'vitest';
import { parseOutputFormat, toJson, toHuman, resolveStdinFlag, isTTY } from '@/cli/formatters.js';

describe('parseOutputFormat', () => {
  it('should default to json when --output not specified', () => {
    expect(parseOutputFormat([])).toBe('json');
    expect(parseOutputFormat(['--chain-id', '1'])).toBe('json');
  });

  it('should parse json format', () => {
    expect(parseOutputFormat(['--output', 'json'])).toBe('json');
  });

  it('should parse human format', () => {
    expect(parseOutputFormat(['--output', 'human'])).toBe('human');
  });

  it('should parse raw format', () => {
    expect(parseOutputFormat(['--output', 'raw'])).toBe('raw');
  });

  it('should throw for invalid format', () => {
    expect(() => parseOutputFormat(['--output', 'xml'])).toThrow('Invalid output format: xml');
  });

  it('should throw when --output has no value', () => {
    expect(() => parseOutputFormat(['--output'])).toThrow('Missing value for --output');
  });

  it('should throw when --output is followed by another flag', () => {
    expect(() => parseOutputFormat(['--output', '--chain-id'])).toThrow('Missing value for --output');
  });

  it('should work with other flags mixed in', () => {
    expect(parseOutputFormat(['--chain-id', '1', '--output', 'human', '--to', '0x'])).toBe('human');
  });
});

describe('toJson', () => {
  it('should stringify with pretty printing by default', () => {
    const result = toJson({ a: 1 });
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it('should stringify without pretty printing when requested', () => {
    const result = toJson({ a: 1 }, false);
    expect(result).toBe('{"a":1}');
  });

  it('should handle BigInt values', () => {
    const result = toJson({ amount: 999999999999999999n });
    const parsed = JSON.parse(result);
    expect(parsed.amount).toBe('999999999999999999');
  });

  it('should handle nested objects with BigInt', () => {
    const result = toJson({ args: { amount: 100n, spender: '0xabc' } });
    const parsed = JSON.parse(result);
    expect(parsed.args.amount).toBe('100');
    expect(parsed.args.spender).toBe('0xabc');
  });
});

describe('toHuman', () => {
  it('should format key-value pairs as aligned table', () => {
    const result = toHuman({ protocol: 'erc20', action: 'approve' });
    expect(result).toContain('protocol');
    expect(result).toContain('erc20');
    expect(result).toContain('action');
    expect(result).toContain('approve');
  });

  it('should include title when provided', () => {
    const result = toHuman({ key: 'value' }, 'Test Title');
    expect(result).toContain('--- Test Title ---');
  });

  it('should handle empty data', () => {
    const result = toHuman({});
    expect(result).toBe('');
  });

  it('should handle BigInt values', () => {
    const result = toHuman({ amount: 123n });
    expect(result).toContain('123');
  });

  it('should inline nested objects as JSON', () => {
    const result = toHuman({ args: { spender: '0x123' } });
    expect(result).toContain('{"spender":"0x123"}');
  });
});

describe('resolveStdinFlag', () => {
  it('should return value unchanged when not "-"', async () => {
    expect(await resolveStdinFlag('0xdeadbeef')).toBe('0xdeadbeef');
    expect(await resolveStdinFlag('hello')).toBe('hello');
  });
});

describe('isTTY', () => {
  it('should return a boolean', () => {
    // In test environment, process.stdin.isTTY is typically undefined (not a TTY)
    expect(typeof isTTY()).toBe('boolean');
  });

  it('should return false in non-TTY test environment', () => {
    // Vitest runs in a non-TTY environment
    expect(isTTY()).toBe(false);
  });
});
