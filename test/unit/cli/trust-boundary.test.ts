import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const CLI_DIR = resolve(import.meta.dirname, '../../../src/cli');

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
  const staticRe = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticRe.exec(content)) !== null) imports.push(match[1]);
  const reExportRe = /export\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportRe.exec(content)) !== null) imports.push(match[1]);
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRe.exec(content)) !== null) imports.push(match[1]);
  return imports;
}

/**
 * CLI trust boundary: src/cli/ may only import from:
 * - Within src/cli/ (internal)
 * - src/index.js (root public API)
 * - src/protocols/index.js (protocols public API)
 * - src/agentic/index.js (agentic public API)
 * - npm packages / node built-ins
 */
function isViolation(importPath: string, filePath: string): boolean {
  if (!importPath.startsWith('.')) return false;

  const fileDir = dirname(filePath);
  const resolved = resolve(fileDir, importPath);

  if (resolved.startsWith(CLI_DIR)) return false;

  const srcDir = resolve(CLI_DIR, '..');
  const allowedTargets = [
    resolve(srcDir, 'index.js'),
    resolve(srcDir, 'protocols', 'index.js'),
    resolve(srcDir, 'agentic', 'index.js'),
  ];

  const baseName = resolved.replace(/\.(js|ts)$/, '');
  const allowedBaseNames = allowedTargets.map((t) => t.replace(/\.js$/, ''));

  return !allowedBaseNames.includes(baseName);
}

describe('CLI Trust Boundary', () => {
  const files = getAllTsFiles(CLI_DIR);

  it('should find .ts files in src/cli/', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('src/cli/ files only import from allowed public APIs, internal paths, or npm packages', () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      const relFile = file.replace(CLI_DIR + '/', '');

      for (const imp of imports) {
        if (isViolation(imp, file)) {
          violations.push(`${relFile} imports '${imp}' (violates trust boundary)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
