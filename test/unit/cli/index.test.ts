import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CLI index.ts is a self-executing entry point (calls main() at module load).
 * Instead of importing it (which triggers process.argv reading + process.exit),
 * we verify the module structure to ensure all subcommands are wired.
 *
 * Individual command handlers are tested in test/unit/cli/commands/*.test.ts.
 * The full MCP path is tested in test/e2e/mcp-server.test.ts.
 */
describe('CLI index module structure', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../src/cli/index.ts'),
    'utf-8',
  );

  it('should import all 8 subcommand handlers', () => {
    expect(source).toContain("from './commands/sign.js'");
    expect(source).toContain("from './commands/sign-permit.js'");
    expect(source).toContain("from './commands/dry-run.js'");
    expect(source).toContain("from './commands/get-address.js'");
    expect(source).toContain("from './commands/health.js'");
    expect(source).toContain("from './commands/mcp.js'");
    expect(source).toContain("from './commands/decode.js'");
    expect(source).toContain("from './commands/encode.js'");
  });

  it('should route all 8 subcommands in switch statement', () => {
    expect(source).toContain("case 'sign':");
    expect(source).toContain("case 'sign-permit':");
    expect(source).toContain("case 'dry-run':");
    expect(source).toContain("case 'get-address':");
    expect(source).toContain("case 'health':");
    expect(source).toContain("case 'mcp':");
    expect(source).toContain("case 'encode':");
    expect(source).toContain("case 'decode':");
    // default case for unknown subcommands
    expect(source).toContain('default:');
    expect(source).toContain('usage()');
  });

  it('should have top-level error handler with plain text output', () => {
    expect(source).toContain('main().catch(');
    expect(source).toContain('process.exit(1)');
    // Error handler should output plain text, not JSON
    expect(source).toMatch(/Error: \$\{message\}/);
  });

  it('should support --help and -h flags with exit code 0', () => {
    expect(source).toContain("'--help'");
    expect(source).toContain("'-h'");
    expect(source).toContain('usage(0)');
  });

  it('should exit with code 1 when no subcommand provided', () => {
    // No subcommand must not exit 0 (that would silently pass in CI)
    expect(source).toContain('if (!subcommand)');
    expect(source).toContain('usage(1)');
  });

  it('should support subcommand-level --help', () => {
    // rest.includes('--help') check before switch dispatch
    expect(source).toContain("rest.includes('--help')");
    expect(source).toContain("rest.includes('-h')");
  });
});
