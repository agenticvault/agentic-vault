import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PROTOCOLS_DIR = resolve(import.meta.dirname, '../../../src/protocols');

// ============================================================================
// Helpers
// ============================================================================

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];

  // Static imports: import ... from 'path'
  const staticRe = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticRe.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Re-exports: export ... from 'path'
  const reExportRe = /export\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportRe.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic imports: import('path')
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRe.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

// ============================================================================
// Tests
// ============================================================================

describe('Protocols Trust Boundary', () => {
  const files = getAllTsFiles(PROTOCOLS_DIR);

  it('should find .ts files in src/protocols/', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('src/protocols/ files should NOT import from @modelcontextprotocol/*', () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      const relFile = file.replace(PROTOCOLS_DIR + '/', '');

      for (const imp of imports) {
        if (imp.startsWith('@modelcontextprotocol/')) {
          violations.push(`${relFile} imports '${imp}' (MCP dependency in protocols layer)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('src/protocols/ files should NOT import from src/agentic/', () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      const relFile = file.replace(PROTOCOLS_DIR + '/', '');

      for (const imp of imports) {
        // Check for relative imports that would go into agentic/
        if (imp.includes('/agentic/') || imp.startsWith('../agentic/')) {
          violations.push(`${relFile} imports '${imp}' (cross-layer import into agentic)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('src/protocols/ files only import from relative paths, viem, or node: builtins', () => {
    const violations: string[] = [];
    const allowedPackages = ['viem'];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      const relFile = file.replace(PROTOCOLS_DIR + '/', '');

      for (const imp of imports) {
        if (imp.startsWith('.')) continue; // relative imports OK
        if (imp.startsWith('node:')) continue; // node builtins OK
        if (allowedPackages.some((pkg) => imp === pkg || imp.startsWith(`${pkg}/`))) continue;

        violations.push(`${relFile} imports '${imp}' (unexpected external dependency)`);
      }
    }

    expect(violations).toEqual([]);
  });
});
