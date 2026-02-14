import { createInterface } from 'node:readline';

export type OutputFormat = 'json' | 'human' | 'raw';

/**
 * Parse --output flag from argv.
 * Returns 'json' as default when not specified.
 */
export function parseOutputFormat(argv: string[]): OutputFormat {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output') {
      const fmt = argv[i + 1];
      if (!fmt || fmt.startsWith('--')) {
        throw new Error('Missing value for --output. Use json, human, or raw');
      }
      if (fmt === 'json' || fmt === 'human' || fmt === 'raw') return fmt;
      throw new Error(`Invalid output format: ${fmt}. Use json, human, or raw`);
    }
  }
  return 'json';
}

const bigintReplacer = (_k: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString() : v;

/** BigInt-safe JSON stringify */
export function toJson(data: unknown, pretty = true): string {
  return JSON.stringify(data, bigintReplacer, pretty ? 2 : 0);
}

/** Read a single line from stdin (for --data - support) */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin });
    let line = '';
    rl.on('line', (l) => { line = l.trim(); rl.close(); });
    rl.on('close', () => resolve(line));
    rl.on('error', reject);
  });
}

/** Resolve a flag value, reading from stdin if value is '-' */
export async function resolveStdinFlag(value: string): Promise<string> {
  if (value === '-') return readStdin();
  return value;
}

/** Check if running in interactive TTY mode (both stdin and stdout) */
export function isTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Prompt user for yes/no confirmation in TTY mode */
export async function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/** Format key-value record as aligned table */
export function toHuman(data: Record<string, unknown>, title?: string): string {
  const lines: string[] = [];
  if (title) lines.push(`--- ${title} ---`);
  const keys = Object.keys(data);
  if (keys.length === 0) return lines.join('\n');
  const maxKeyLen = Math.max(...keys.map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    const v =
      typeof value === 'bigint'
        ? value.toString()
        : typeof value === 'object' && value !== null
          ? toJson(value, false)
          : String(value);
    lines.push(`${key.padEnd(maxKeyLen)}  ${v}`);
  }
  return lines.join('\n');
}
