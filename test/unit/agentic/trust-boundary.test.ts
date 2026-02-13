import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';

const AGENTIC_DIR = resolve(import.meta.dirname, '../../../src/agentic');

// ============================================================================
// Helpers
// ============================================================================

/** Recursively collect all .ts files under a directory */
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

/** Extract all import/re-export paths from static imports, re-exports, and dynamic imports */
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

/**
 * Determine whether a relative import from a file inside src/agentic/ violates
 * the trust boundary.
 *
 * Allowed relative imports:
 *   - Within src/agentic/ (resolved path stays inside AGENTIC_DIR)
 *   - To src/index.ts via ../../index.js or ../index.js (depending on depth)
 *
 * Disallowed:
 *   - Any parent-relative import that resolves outside AGENTIC_DIR and is NOT
 *     pointing to src/index.js (e.g. ../../kms-client.js, ../../core/...)
 */
function isViolation(importPath: string, filePath: string): boolean {
  // Only check relative imports
  if (!importPath.startsWith('.')) {
    return false;
  }

  const fileDir = dirname(filePath);
  const resolved = resolve(fileDir, importPath);

  // If it resolves inside the agentic directory, it's fine
  if (resolved.startsWith(AGENTIC_DIR)) {
    return false;
  }

  // It resolves outside agentic/ — only allow if it points to an allowed target
  const srcDir = resolve(AGENTIC_DIR, '..');
  const allowedTargets = [
    resolve(srcDir, 'index.js'),           // root public API
    resolve(srcDir, 'protocols', 'index.js'), // protocols public API
  ];

  // Normalize: the import might be ../../index.js which resolves to src/index.js
  // Also handle the case without extension or with .ts extension
  const baseName = resolved.replace(/\.(js|ts)$/, '');
  const allowedBaseNames = allowedTargets.map((t) => t.replace(/\.js$/, ''));

  return !allowedBaseNames.includes(baseName);
}

// ============================================================================
// Tests
// ============================================================================

describe('Trust Boundary', () => {
  const files = getAllTsFiles(AGENTIC_DIR);

  it('should find .ts files in src/agentic/', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('src/agentic/ files only import from index.js, internal paths, or npm packages', () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      const relFile = relative(AGENTIC_DIR, file);

      for (const imp of imports) {
        if (isViolation(imp, file)) {
          violations.push(`${relFile} imports '${imp}' (violates trust boundary)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('cli.ts imports from ../../index.js are allowed (the known cross-boundary import)', () => {
    const cliPath = join(AGENTIC_DIR, 'cli.ts');
    const content = readFileSync(cliPath, 'utf-8');
    const imports = extractImports(content);

    // cli.ts should import from ../index.js — verify it is NOT flagged as a violation
    const crossBoundary = imports.filter((imp) => imp.startsWith('.') && !imp.startsWith('./'));
    expect(crossBoundary.length).toBeGreaterThan(0);

    for (const imp of crossBoundary) {
      expect(isViolation(imp, cliPath)).toBe(false);
    }
  });

  it('should flag hypothetical violations', () => {
    // Verify the detection logic works by testing synthetic cases

    // From src/agentic/mcp/tools/fake.ts (depth 2 inside agentic):
    //   ../../../ goes to src/
    //   ../../ goes to src/agentic/  (still inside — not a violation)
    const deepFile = join(AGENTIC_DIR, 'mcp', 'tools', 'fake.ts');

    // Violations: going up to src/ level and importing non-index files
    expect(isViolation('../../../kms-client.js', deepFile)).toBe(true);
    expect(isViolation('../../../core/signing-provider.js', deepFile)).toBe(true);
    expect(isViolation('../../../providers/aws-kms/aws-kms-provider.js', deepFile)).toBe(true);

    // Not a violation: ../../../index.js resolves to src/index.js (allowed)
    expect(isViolation('../../../index.js', deepFile)).toBe(false);

    // Not a violation: ../../../protocols/index.js resolves to src/protocols/index.js (allowed)
    expect(isViolation('../../../protocols/index.js', deepFile)).toBe(false);

    // Violation: deep import into protocols/ (not through index.js)
    expect(isViolation('../../../protocols/policy/engine.js', deepFile)).toBe(true);
    expect(isViolation('../../../protocols/types.js', deepFile)).toBe(true);

    // Not a violation: relative inside agentic/
    expect(isViolation('./shared.js', deepFile)).toBe(false);
    expect(isViolation('../server.js', deepFile)).toBe(false);

    // From src/agentic/cli.ts (depth 0 inside agentic):
    //   ../ goes to src/
    const shallowFile = join(AGENTIC_DIR, 'cli.ts');

    // Violations: going to src/ and importing non-index files
    expect(isViolation('../kms-client.js', shallowFile)).toBe(true);
    expect(isViolation('../core/evm-signer-adapter.js', shallowFile)).toBe(true);

    // Not a violation: ../index.js resolves to src/index.js (allowed)
    expect(isViolation('../index.js', shallowFile)).toBe(false);

    // Not a violation: ../protocols/index.js resolves to src/protocols/index.js (allowed)
    expect(isViolation('../protocols/index.js', shallowFile)).toBe(false);

    // Violation: deep import into protocols/ from shallow depth
    expect(isViolation('../protocols/policy/engine.js', shallowFile)).toBe(true);

    // Not a violation: relative inside agentic/
    expect(isViolation('./policy/engine.js', shallowFile)).toBe(false);
    expect(isViolation('./mcp/server.js', shallowFile)).toBe(false);
  });

  it('npm package imports are not flagged', () => {
    const fakeFile = join(AGENTIC_DIR, 'mcp', 'server.ts');
    expect(isViolation('@modelcontextprotocol/sdk/server/mcp.js', fakeFile)).toBe(false);
    expect(isViolation('zod', fakeFile)).toBe(false);
    expect(isViolation('node:fs', fakeFile)).toBe(false);
  });
});
