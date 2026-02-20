import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

import {
  resolveTargetDir,
  resolveSourceDir,
  copyPluginFiles,
  generateConfigSnippet,
  run,
} from '../../src/install.js';

// Helper: create a unique temp dir for each test
function makeTempDir(prefix: string): string {
  const dir = join(tmpdir(), `install-test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('install.ts', () => {
  // ── resolveTargetDir ──────────────────────────────────────────────────

  describe('resolveTargetDir', () => {
    it('returns default path (~/.openclaw/extensions/agentic-vault) when no override', () => {
      const result = resolveTargetDir();
      expect(result).toBe(join(homedir(), '.openclaw', 'extensions', 'agentic-vault'));
    });

    it('returns the override path when provided', () => {
      const override = '/tmp/custom-target';
      const result = resolveTargetDir(override);
      expect(result).toBe(override);
    });

    it('resolves relative override to absolute path', () => {
      const result = resolveTargetDir('relative/path');
      expect(result).toMatch(/^\//); // absolute
      expect(result).toContain('relative/path');
    });
  });

  // ── resolveSourceDir ──────────────────────────────────────────────────

  describe('resolveSourceDir', () => {
    it('returns parent of __dirname by default (package root)', () => {
      const result = resolveSourceDir();
      // __dirname points to dist/ or src/, parent should be the package root
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns the override path when provided', () => {
      const override = '/tmp/custom-source';
      const result = resolveSourceDir(override);
      expect(result).toBe(override);
    });
  });

  // ── copyPluginFiles ───────────────────────────────────────────────────

  describe('copyPluginFiles', () => {
    let sourceDir: string;
    let targetDir: string;

    beforeEach(() => {
      sourceDir = makeTempDir('copy-src');
      targetDir = makeTempDir('copy-tgt');
    });

    afterEach(() => {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(targetDir, { recursive: true, force: true });
    });

    it('copies existing entries and returns their names', () => {
      // Create source files
      mkdirSync(join(sourceDir, 'dist'), { recursive: true });
      writeFileSync(join(sourceDir, 'dist', 'index.js'), '// dist');
      writeFileSync(join(sourceDir, 'package.json'), '{}');
      writeFileSync(join(sourceDir, 'openclaw.plugin.json'), '{}');

      const copied = copyPluginFiles(sourceDir, targetDir);

      expect(copied).toContain('dist');
      expect(copied).toContain('package.json');
      expect(copied).toContain('openclaw.plugin.json');
      expect(existsSync(join(targetDir, 'dist', 'index.js'))).toBe(true);
      expect(existsSync(join(targetDir, 'package.json'))).toBe(true);
    });

    it('skips missing entries without error', () => {
      // Only create one file — others should be skipped
      writeFileSync(join(sourceDir, 'package.json'), '{}');

      const copied = copyPluginFiles(sourceDir, targetDir);

      expect(copied).toEqual(['package.json']);
      expect(existsSync(join(targetDir, 'dist'))).toBe(false);
      expect(existsSync(join(targetDir, 'LICENSE'))).toBe(false);
    });

    it('returns empty array when no entries exist', () => {
      const emptySource = makeTempDir('copy-empty');
      const copied = copyPluginFiles(emptySource, targetDir);
      expect(copied).toEqual([]);
      rmSync(emptySource, { recursive: true, force: true });
    });
  });

  // ── generateConfigSnippet ─────────────────────────────────────────────

  describe('generateConfigSnippet', () => {
    it('returns valid JSON with correct structure', () => {
      const snippet = generateConfigSnippet();
      const parsed = JSON.parse(snippet);

      expect(parsed).toHaveProperty('plugins.allow');
      expect(parsed.plugins.allow).toContain('agentic-vault');
      expect(parsed).toHaveProperty('plugins.entries.agentic-vault.config.keyId');
      expect(parsed).toHaveProperty('plugins.entries.agentic-vault.config.region');
    });

    it('uses placeholder values for keyId and region', () => {
      const snippet = generateConfigSnippet();
      const parsed = JSON.parse(snippet);

      expect(parsed.plugins.entries['agentic-vault'].config.keyId).toContain('<');
      expect(parsed.plugins.entries['agentic-vault'].config.region).toContain('<');
    });
  });

  // ── run() ─────────────────────────────────────────────────────────────

  describe('run', () => {
    let sourceDir: string;
    let targetDir: string;

    beforeEach(() => {
      sourceDir = makeTempDir('run-src');
      targetDir = makeTempDir('run-tgt');
      // Clean target so run() creates it
      rmSync(targetDir, { recursive: true, force: true });
    });

    afterEach(() => {
      rmSync(sourceDir, { recursive: true, force: true });
      rmSync(targetDir, { recursive: true, force: true });
    });

    it('happy path: copies files and prints config snippet', () => {
      // Set up minimal source
      mkdirSync(join(sourceDir, 'dist'), { recursive: true });
      writeFileSync(join(sourceDir, 'dist', 'index.js'), '// built');
      writeFileSync(join(sourceDir, 'package.json'), '{"name":"test"}');
      writeFileSync(join(sourceDir, 'openclaw.plugin.json'), '{"id":"agentic-vault"}');

      const output: string[] = [];
      const write = (msg: string) => { output.push(msg); };

      run({
        sourceDir,
        targetDir,
        write,
        skipNpmInstall: true,
      });

      const combined = output.join('');

      // Should report copied files
      expect(combined).toContain('dist');
      expect(combined).toContain('package.json');
      expect(combined).toContain('openclaw.plugin.json');
      // Should print config snippet
      expect(combined).toContain('"agentic-vault"');
      // Should print next steps
      expect(combined).toContain('Next steps');
      // Target dir should have files
      expect(existsSync(join(targetDir, 'dist', 'index.js'))).toBe(true);
      // process.exitCode should not be set (or remain undefined)
      expect(process.exitCode).toBeUndefined();
    });

    it('reports error when source dir is empty (no plugin files)', () => {
      const emptySource = makeTempDir('run-empty');

      const output: string[] = [];
      const write = (msg: string) => { output.push(msg); };

      // Reset exitCode
      process.exitCode = undefined;

      run({
        sourceDir: emptySource,
        targetDir,
        write,
        skipNpmInstall: true,
      });

      const combined = output.join('');
      expect(combined).toContain('Error');
      expect(combined).toContain('No plugin files found');
      expect(process.exitCode).toBe(1);

      // Cleanup
      process.exitCode = undefined;
      rmSync(emptySource, { recursive: true, force: true });
    });

    it('reports error when required files are missing (partial copy)', () => {
      // Only provide LICENSE — missing dist and package.json (required)
      writeFileSync(join(sourceDir, 'LICENSE'), 'MIT');

      const output: string[] = [];
      const write = (msg: string) => { output.push(msg); };

      process.exitCode = undefined;

      run({
        sourceDir,
        targetDir,
        write,
        skipNpmInstall: true,
      });

      const combined = output.join('');
      expect(combined).toContain('Missing required files');
      expect(combined).toContain('dist');
      expect(combined).toContain('package.json');
      expect(process.exitCode).toBe(1);

      // Cleanup
      process.exitCode = undefined;
    });

    it('reports unsupported on Windows platform', () => {
      const output: string[] = [];
      const write = (msg: string) => { output.push(msg); };

      process.exitCode = undefined;

      run({
        sourceDir,
        targetDir,
        write,
        skipNpmInstall: true,
        _platform: 'win32',
      });

      const combined = output.join('');
      expect(combined).toContain('Windows is not supported');
      expect(process.exitCode).toBe(1);

      // Cleanup
      process.exitCode = undefined;
    });
  });
});
