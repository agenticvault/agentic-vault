import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ============================================================================
// Trust Boundary Test
//
// Verifies that all .ts files in packages/openclaw-plugin/src/ only import from:
//   - @agenticvault/agentic-vault (root public API)
//   - @agenticvault/agentic-vault/protocols (protocols subpath)
//   - node:* (Node.js built-ins)
//   - ./ or ../ (local relative imports)
//
// Disallowed:
//   - Deep imports like @agenticvault/agentic-vault/core/...
//   - @agenticvault/agentic-vault/agentic (not needed by plugin)
//   - Any other external package not in peerDependencies
// ============================================================================

const SRC_DIR = resolve(import.meta.dirname, '../src');

const ALLOWED_IMPORT_PATTERNS = [
  /^['"]@agenticvault\/agentic-vault['"]/, // exact match: @agenticvault/agentic-vault
  /^['"]@agenticvault\/agentic-vault\/protocols['"]/, // exact match: protocols subpath
  /^['"]node:/, // Node.js built-in modules
  /^['"]\.\.?\//, // relative imports (./xxx or ../xxx)
];

const IMPORT_RE = /^\s*import\s+(?:type\s+)?(?:{[^}]*}|[^'"]*)\s+from\s+(['"][^'"]+['"])/gm;
const SIDE_EFFECT_IMPORT_RE = /^\s*import\s+(['"][^'"]+['"])\s*;?\s*$/gm;
const EXPORT_FROM_RE = /^\s*export\s+(?:type\s+)?(?:{[^}]*}|\*)\s+from\s+(['"][^'"]+['"])/gm;
const DYNAMIC_IMPORT_RE = /import\(\s*(['"][^'"]+['"])\s*\)/g;

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

function extractImportSources(content: string): string[] {
  const sources: string[] = [];

  for (const match of content.matchAll(IMPORT_RE)) {
    sources.push(match[1]);
  }
  for (const match of content.matchAll(SIDE_EFFECT_IMPORT_RE)) {
    sources.push(match[1]);
  }
  for (const match of content.matchAll(EXPORT_FROM_RE)) {
    sources.push(match[1]);
  }
  for (const match of content.matchAll(DYNAMIC_IMPORT_RE)) {
    sources.push(match[1]);
  }

  return sources;
}

function isAllowed(importSource: string): boolean {
  return ALLOWED_IMPORT_PATTERNS.some((pattern) => pattern.test(importSource));
}

describe('trust boundary', () => {
  const tsFiles = collectTsFiles(SRC_DIR);

  it('should have at least one source file to scan', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of tsFiles) {
    const relativePath = filePath.replace(SRC_DIR + '/', '');

    it(`${relativePath} — should only import from allowed sources`, () => {
      const content = readFileSync(filePath, 'utf-8');
      const sources = extractImportSources(content);

      const violations = sources.filter((src) => !isAllowed(src));

      expect(
        violations,
        `Disallowed imports found in ${relativePath}:\n${violations.join('\n')}\n\nAllowed: @agenticvault/agentic-vault, @agenticvault/agentic-vault/protocols, node:*, ./`,
      ).toEqual([]);
    });
  }

  it('should not contain deep imports into @agenticvault/agentic-vault/*', () => {
    for (const filePath of tsFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const sources = extractImportSources(content);

      const deepImports = sources.filter((src) => {
        const cleaned = src.replace(/^['"]|['"]$/g, '');
        return (
          cleaned.startsWith('@agenticvault/agentic-vault/') &&
          cleaned !== '@agenticvault/agentic-vault/protocols'
        );
      });

      expect(
        deepImports,
        `Deep imports found in ${filePath.replace(SRC_DIR + '/', '')}:\n${deepImports.join('\n')}`,
      ).toEqual([]);
    }
  });
});
