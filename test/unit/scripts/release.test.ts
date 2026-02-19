import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import {
  isValidSemver,
  assertShellSafe,
  readPackageJson,
  writePackageJson,
  readPluginManifest,
  writePluginManifest,
  isGitClean,
  getVersion,
  getOpenClawVersion,
  gitTagExists,
  findTarball,
  cleanupTarballs,
  preflight,
  firstPublish,
  bump,
  tag,
  main,
  type RunOptions,
} from '../../../scripts/release.js';

// ---------------------------------------------------------------------------
// Mock fs for readPackageJson / writePackageJson
// ---------------------------------------------------------------------------

vi.mock('node:fs', async () => {
  const original = await vi.importActual<object>('node:fs');
  return {
    ...original,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    unlinkSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
  };
});

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockExistsSync = vi.mocked(existsSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockOpts(overrides?: Partial<RunOptions>): RunOptions & { output: string[] } {
  const output: string[] = [];
  return {
    output,
    exec: vi.fn().mockReturnValue(''),
    rootDir: '/fake/root',
    stdout: (msg: string) => output.push(msg),
    stderr: (msg: string) => output.push(`[stderr] ${msg}`),
    ...overrides,
  };
}

function makePkgJson(version: string, extra?: Record<string, unknown>): string {
  return JSON.stringify({ name: '@agenticvault/agentic-vault', version, ...extra });
}

function makeOcPkgJson(version: string, peerDep?: string): string {
  return JSON.stringify({
    name: '@agenticvault/openclaw',
    version,
    peerDependencies: { '@agenticvault/agentic-vault': peerDep ?? `~${version}` },
  });
}

function makePluginManifest(version: string): string {
  return JSON.stringify({ name: 'agentic-vault', version });
}

// ---------------------------------------------------------------------------
// isValidSemver
// ---------------------------------------------------------------------------

describe('isValidSemver', () => {
  it.each([
    ['0.1.0', true],
    ['1.0.0', true],
    ['1.2.3-beta.1', true],
    ['10.20.30', true],
    ['1.0.0-rc.1', true],
  ])('should accept valid semver: %s', (input, expected) => {
    expect(isValidSemver(input)).toBe(expected);
  });

  it.each([
    ['v0.1.0', false],
    ['0.1', false],
    ['abc', false],
    ['1.0.0.0', false],
    ['', false],
    ['0.1.0-', false],
  ])('should reject invalid semver: %s', (input, expected) => {
    expect(isValidSemver(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// assertShellSafe
// ---------------------------------------------------------------------------

describe('assertShellSafe', () => {
  it.each([
    '0.1.0',
    'v0.1.0',
    'openclaw-v0.1.0',
    '@agenticvault/agentic-vault',
    'agenticvault-openclaw-0.1.0.tgz',
    '~0.1.0',
  ])('should accept safe value: %s', (value) => {
    expect(() => assertShellSafe(value, 'test')).not.toThrow();
  });

  it.each([
    'foo bar',
    'foo;rm -rf /',
    'foo$(cmd)',
    'foo`cmd`',
    "foo'bar",
    'foo"bar',
    'foo|bar',
    'foo&bar',
  ])('should reject unsafe value: %s', (value) => {
    expect(() => assertShellSafe(value, 'test')).toThrow('Unsafe test');
  });
});

// ---------------------------------------------------------------------------
// readPackageJson / writePackageJson
// ---------------------------------------------------------------------------

describe('readPackageJson', () => {
  it('should parse package.json from file', () => {
    mockReadFileSync.mockReturnValue(makePkgJson('1.0.0'));
    const pkg = readPackageJson('/fake/package.json');
    expect(pkg.version).toBe('1.0.0');
    expect(mockReadFileSync).toHaveBeenCalledWith('/fake/package.json', 'utf-8');
  });
});

describe('writePackageJson', () => {
  it('should write formatted JSON with trailing newline', () => {
    const pkg = { name: '@agenticvault/agentic-vault', version: '2.0.0' };
    writePackageJson('/fake/package.json', pkg);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/fake/package.json',
      JSON.stringify(pkg, null, 2) + '\n',
    );
  });
});

// ---------------------------------------------------------------------------
// readPluginManifest / writePluginManifest
// ---------------------------------------------------------------------------

describe('readPluginManifest', () => {
  it('should parse plugin manifest from file', () => {
    mockReadFileSync.mockReturnValue(makePluginManifest('0.1.0'));
    const manifest = readPluginManifest('/fake/plugin.json');
    expect(manifest.version).toBe('0.1.0');
  });
});

describe('writePluginManifest', () => {
  it('should write formatted JSON with trailing newline', () => {
    const manifest = { name: 'agentic-vault', version: '2.0.0' };
    writePluginManifest('/fake/plugin.json', manifest);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/fake/plugin.json',
      JSON.stringify(manifest, null, 2) + '\n',
    );
  });
});

// ---------------------------------------------------------------------------
// isGitClean
// ---------------------------------------------------------------------------

describe('isGitClean', () => {
  it('should return true when git status is empty', () => {
    const run = vi.fn().mockReturnValue('');
    expect(isGitClean('/root', run)).toBe(true);
  });

  it('should return false when git status has output', () => {
    const run = vi.fn().mockReturnValue(' M package.json');
    expect(isGitClean('/root', run)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getVersion / getOpenClawVersion
// ---------------------------------------------------------------------------

describe('getVersion', () => {
  it('should read version from root package.json', () => {
    mockReadFileSync.mockReturnValue(makePkgJson('0.5.0'));
    expect(getVersion('/root')).toBe('0.5.0');
  });
});

describe('getOpenClawVersion', () => {
  it('should read version from openclaw package.json', () => {
    mockReadFileSync.mockReturnValue(makeOcPkgJson('0.3.0'));
    expect(getOpenClawVersion('/root')).toBe('0.3.0');
  });
});

// ---------------------------------------------------------------------------
// findTarball
// ---------------------------------------------------------------------------

describe('findTarball', () => {
  it('should return full path when .tgz files exist', () => {
    mockReaddirSync.mockReturnValue(['agenticvault-openclaw-0.1.0.tgz'] as never);
    const result = findTarball('/fake/dir');
    expect(result).toBe(resolve('/fake/dir', 'agenticvault-openclaw-0.1.0.tgz'));
  });

  it('should return first tarball when multiple exist', () => {
    mockReaddirSync.mockReturnValue([
      'agenticvault-openclaw-0.0.9.tgz',
      'agenticvault-openclaw-0.1.0.tgz',
    ] as never);
    const result = findTarball('/fake/dir');
    expect(result).toBe(resolve('/fake/dir', 'agenticvault-openclaw-0.0.9.tgz'));
  });

  it('should return null when no .tgz files exist', () => {
    mockReaddirSync.mockReturnValue(['package.json', 'README.md'] as never);
    expect(findTarball('/fake/dir')).toBeNull();
  });

  it('should return null when directory does not exist', () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(findTarball('/nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cleanupTarballs
// ---------------------------------------------------------------------------

describe('cleanupTarballs', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockUnlinkSync.mockReset();
  });

  it('should delete all .tgz files in directory', () => {
    mockReaddirSync.mockReturnValue([
      'package.json',
      'old-0.0.9.tgz',
      'new-0.1.0.tgz',
    ] as never);

    cleanupTarballs('/fake/dir');

    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
    expect(mockUnlinkSync).toHaveBeenCalledWith(resolve('/fake/dir', 'old-0.0.9.tgz'));
    expect(mockUnlinkSync).toHaveBeenCalledWith(resolve('/fake/dir', 'new-0.1.0.tgz'));
  });

  it('should not throw when directory does not exist', () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(() => cleanupTarballs('/nonexistent')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// gitTagExists
// ---------------------------------------------------------------------------

describe('gitTagExists', () => {
  it('should return true when rev-parse succeeds', () => {
    const run = vi.fn().mockReturnValue('abc123');
    expect(gitTagExists('v0.1.0', '/root', run)).toBe(true);
    expect(run).toHaveBeenCalledWith('git rev-parse --verify refs/tags/v0.1.0', { cwd: '/root' });
  });

  it('should return false when rev-parse throws', () => {
    const run = vi.fn().mockImplementation(() => {
      throw new Error('not found');
    });
    expect(gitTagExists('v0.1.0', '/root', run)).toBe(false);
  });

  it('should use refs/tags/ prefix to avoid matching branches', () => {
    const run = vi.fn().mockReturnValue('abc123');
    gitTagExists('v0.1.0', '/root', run);
    const cmd = run.mock.calls[0][0] as string;
    expect(cmd).toContain('refs/tags/');
  });
});

// ---------------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------------

describe('preflight', () => {
  it('should run all checks in order', () => {
    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        if (cmd === 'node -v') return 'v24.0.0';
        if (cmd === 'npm -v') return '11.0.0';
        if (cmd === 'pnpm -v') return '9.0.0';
        if (cmd === 'npm whoami') return 'testuser';
        if (cmd === 'git status --porcelain') return '';
        if (cmd.includes('pnpm pack --dry-run')) return 'Tarball contents...';
        return '';
      }),
    });

    // Mock package.json reads for getVersion / getOpenClawVersion
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    preflight(opts);

    // Verify key commands were called
    expect(calls).toContain('node -v');
    expect(calls).toContain('npm -v');
    expect(calls).toContain('pnpm -v');
    expect(calls).toContain('npm whoami');
    expect(calls).toContain('git status --porcelain');
    expect(calls).toContain('pnpm build');
    expect(calls).toContain('pnpm lint');
    expect(calls).toContain('pnpm test:unit');
    expect(opts.output.some((line) => line.includes('All checks passed'))).toBe(true);
  });

  it('should throw when npm whoami fails', () => {
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'node -v') return 'v24.0.0';
        if (cmd === 'npm -v') return '11.0.0';
        if (cmd === 'pnpm -v') return '9.0.0';
        if (cmd === 'npm whoami') throw new Error('not logged in');
        return '';
      }),
    });

    expect(() => preflight(opts)).toThrow('Not logged in to npm');
  });

  it('should warn when git is dirty', () => {
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'node -v') return 'v24.0.0';
        if (cmd === 'npm -v') return '11.0.0';
        if (cmd === 'pnpm -v') return '9.0.0';
        if (cmd === 'npm whoami') return 'testuser';
        if (cmd === 'git status --porcelain') return ' M file.ts';
        if (cmd === 'git status --short') return ' M file.ts';
        if (cmd.includes('pnpm pack --dry-run')) return 'contents';
        return '';
      }),
    });

    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    preflight(opts);

    expect(opts.output.some((line) => line.includes('dirty'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// firstPublish
// ---------------------------------------------------------------------------

describe('firstPublish', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
    mockReaddirSync.mockReset();
  });

  it('should publish both packages in order', () => {
    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        if (cmd.includes('npm view')) return '0.1.0';
        return '';
      }),
    });

    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    // Mock readdirSync to return a tarball after pnpm pack
    mockReaddirSync.mockReturnValue(['agenticvault-openclaw-0.1.0.tgz'] as never);

    firstPublish(opts, false);

    // Should build before publishing
    expect(calls.indexOf('pnpm build')).toBeLessThan(
      calls.findIndex((c) => c.includes('npm publish --access public')),
    );

    // Should publish core
    expect(calls).toContain('npm publish --access public');

    // Should pnpm pack openclaw
    expect(calls).toContain('pnpm pack');

    // Should output success
    expect(opts.output.some((line) => line.includes('First publish complete'))).toBe(true);
  });

  it('should not actually publish in dry-run mode', () => {
    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        return '';
      }),
    });

    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    // Mock readdirSync to return a tarball after pnpm pack
    mockReaddirSync.mockReturnValue(['agenticvault-openclaw-0.1.0.tgz'] as never);

    firstPublish(opts, true);

    // Should include --dry-run in publish commands
    const publishCalls = calls.filter((c) => c.includes('npm publish'));
    for (const call of publishCalls) {
      expect(call).toContain('--dry-run');
    }

    // Should not call npm view (verification)
    expect(calls.filter((c) => c.includes('npm view')).length).toBe(0);
  });

  it('should throw when no tarball is found', () => {
    const opts = createMockOpts({
      exec: vi.fn().mockReturnValue(''),
    });

    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    // Mock readdirSync to return no tarballs
    mockReaddirSync.mockReturnValue([] as never);

    expect(() => firstPublish(opts, false)).toThrow('No .tgz file found');
  });
});

// ---------------------------------------------------------------------------
// bump
// ---------------------------------------------------------------------------

describe('bump', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockExistsSync.mockReset();
  });

  it('should update versions in package.json files and plugin manifests', () => {
    const rootPkg = { name: '@agenticvault/agentic-vault', version: '0.1.0' };
    const ocPkg = {
      name: '@agenticvault/openclaw',
      version: '0.1.0',
      peerDependencies: { '@agenticvault/agentic-vault': '~0.1.0' },
    };
    const manifest = { name: 'agentic-vault', version: '0.1.0' };

    // getVersion, getOpenClawVersion, then root read, then openclaw read, then 2 manifests
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(rootPkg))
      .mockReturnValueOnce(JSON.stringify(ocPkg))
      .mockReturnValueOnce(JSON.stringify(rootPkg))
      .mockReturnValueOnce(JSON.stringify(ocPkg))
      .mockReturnValueOnce(JSON.stringify(manifest))
      .mockReturnValueOnce(JSON.stringify(manifest));

    // Both manifests exist
    mockExistsSync.mockReturnValue(true);

    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        if (cmd === 'git diff --name-only') return 'package.json\npackages/openclaw-plugin/package.json\npnpm-lock.yaml';
        return '';
      }),
    });

    bump(opts, '0.2.0');

    // Verify writeFileSync was called with new versions (2 pkg + 2 manifests)
    const writeCalls = mockWriteFileSync.mock.calls;
    expect(writeCalls.length).toBe(4);

    // Root package.json
    const rootWritten = JSON.parse(writeCalls[0][1] as string);
    expect(rootWritten.version).toBe('0.2.0');

    // OpenClaw package.json
    const ocWritten = JSON.parse(writeCalls[1][1] as string);
    expect(ocWritten.version).toBe('0.2.0');
    expect(ocWritten.peerDependencies['@agenticvault/agentic-vault']).toBe('~0.2.0');

    // Plugin manifests
    const manifest1 = JSON.parse(writeCalls[2][1] as string);
    expect(manifest1.version).toBe('0.2.0');
    const manifest2 = JSON.parse(writeCalls[3][1] as string);
    expect(manifest2.version).toBe('0.2.0');

    // Should run pnpm install --lockfile-only
    expect(calls).toContain('pnpm install --lockfile-only');

    // Should run build + test
    expect(calls).toContain('pnpm build');
    expect(calls).toContain('pnpm test:unit');
  });

  it('should skip missing plugin manifests', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'))
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    // No manifests exist
    mockExistsSync.mockReturnValue(false);

    const opts = createMockOpts({
      exec: vi.fn().mockReturnValue(''),
    });

    bump(opts, '0.2.0');

    // Only 2 writes (no manifests)
    expect(mockWriteFileSync.mock.calls.length).toBe(2);
    expect(opts.output.some((line) => line.includes('[skip]'))).toBe(true);
  });

  it('should throw for invalid semver', () => {
    const opts = createMockOpts();
    expect(() => bump(opts, 'invalid')).toThrow('Invalid semver: invalid');
  });

  it('should throw for semver with v prefix', () => {
    const opts = createMockOpts();
    expect(() => bump(opts, 'v1.0.0')).toThrow('Invalid semver: v1.0.0');
  });

  it('should accept pre-release versions', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'))
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    mockExistsSync.mockReturnValue(false);

    const opts = createMockOpts({
      exec: vi.fn().mockReturnValue(''),
    });

    bump(opts, '0.2.0-beta.1');

    const writeCalls = mockWriteFileSync.mock.calls;
    const rootWritten = JSON.parse(writeCalls[0][1] as string);
    expect(rootWritten.version).toBe('0.2.0-beta.1');
  });
});

// ---------------------------------------------------------------------------
// tag
// ---------------------------------------------------------------------------

describe('tag', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockExistsSync.mockReset();
  });

  it('should create and push tags', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        if (cmd === 'git status --porcelain') return '';
        if (cmd.startsWith('git rev-parse')) throw new Error('not found'); // tags don't exist
        return '';
      }),
    });

    tag(opts, undefined, false);

    expect(calls).toContain('git tag -a v0.1.0 -m "Release @agenticvault/agentic-vault@0.1.0"');
    expect(calls).toContain('git tag -a openclaw-v0.1.0 -m "Release @agenticvault/openclaw@0.1.0"');
    expect(calls).toContain('git push origin v0.1.0 openclaw-v0.1.0');
    expect(opts.output.some((line) => line.includes('Pushed tags'))).toBe(true);
  });

  it('should not create tags in dry-run mode', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        if (cmd === 'git status --porcelain') return '';
        if (cmd.startsWith('git rev-parse')) throw new Error('not found');
        return '';
      }),
    });

    tag(opts, undefined, true);

    // Should NOT create actual tags
    expect(calls.filter((c) => c.startsWith('git tag')).length).toBe(0);
    expect(calls.filter((c) => c.startsWith('git push')).length).toBe(0);
    expect(opts.output.some((line) => line.includes('DRY RUN'))).toBe(true);
  });

  it('should throw when git is dirty', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'git status --porcelain') return ' M file.ts';
        return '';
      }),
    });

    expect(() => tag(opts, undefined, false)).toThrow('Working tree is dirty');
  });

  it('should throw when tags already exist', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'git status --porcelain') return '';
        if (cmd === 'git rev-parse --verify refs/tags/v0.1.0') return 'abc123'; // tag exists
        if (cmd.startsWith('git rev-parse')) throw new Error('not found');
        return '';
      }),
    });

    expect(() => tag(opts, undefined, false)).toThrow('Tags already exist: v0.1.0');
  });

  it('should report both existing tags', () => {
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'));

    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'git status --porcelain') return '';
        if (cmd.startsWith('git rev-parse')) return 'abc123'; // both tags exist
        return '';
      }),
    });

    expect(() => tag(opts, undefined, false)).toThrow('Tags already exist: v0.1.0, openclaw-v0.1.0');
  });

  it('should bump, commit, tag, and push when version is provided', () => {
    // bump reads: getVersion, getOpenClawVersion, root pkg, oc pkg, 2 manifests
    // tag reads: getVersion, getOpenClawVersion (after bump wrote new versions)
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'))
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'))
      .mockReturnValueOnce(makePluginManifest('0.1.0'))
      .mockReturnValueOnce(makePluginManifest('0.1.0'))
      .mockReturnValueOnce(makePkgJson('0.2.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.2.0'));

    mockExistsSync.mockReturnValue(true);

    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        if (cmd === 'git status --porcelain') return '';
        if (cmd === 'git diff --name-only') return 'package.json';
        if (cmd.startsWith('git rev-parse')) throw new Error('not found');
        return '';
      }),
    });

    tag(opts, '0.2.0', false);

    // bump should have written version files
    expect(mockWriteFileSync).toHaveBeenCalled();

    // Should check git clean before bump
    const statusIdx = calls.indexOf('git status --porcelain');
    const installIdx = calls.indexOf('pnpm install --lockfile-only');
    expect(statusIdx).toBeLessThan(installIdx);

    // Should stage and commit bumped files
    const addCmd = calls.find((c) => c.startsWith('git add'));
    expect(addCmd).toBeDefined();
    expect(addCmd).toContain('package.json');
    expect(addCmd).toContain('pnpm-lock.yaml');

    const commitCmd = calls.find((c) => c.startsWith('git commit'));
    expect(commitCmd).toBe('git commit -m "chore: bump version to 0.2.0"');

    // Should create tags with new version
    expect(calls).toContain('git tag -a v0.2.0 -m "Release @agenticvault/agentic-vault@0.2.0"');
    expect(calls).toContain('git tag -a openclaw-v0.2.0 -m "Release @agenticvault/openclaw@0.2.0"');

    // Should push commit + tags with explicit refs
    expect(calls).toContain('git push origin HEAD v0.2.0 openclaw-v0.2.0');
  });

  it('should not run any mutations when version is provided with dry-run', () => {
    mockExistsSync.mockReturnValue(true);

    const calls: string[] = [];
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        calls.push(cmd);
        return '';
      }),
    });

    tag(opts, '0.2.0', true);

    // Should NOT write any files (bump not called)
    expect(mockWriteFileSync).not.toHaveBeenCalled();

    // Should NOT run any shell commands
    expect(calls.length).toBe(0);

    // Should output dry-run preview
    expect(opts.output.some((line) => line.includes('DRY RUN'))).toBe(true);
    expect(opts.output.some((line) => line.includes('bump all versions to 0.2.0'))).toBe(true);
  });

  it('should throw when working tree is dirty with version (pre-bump)', () => {
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'git status --porcelain') return ' M file.ts';
        return '';
      }),
    });

    expect(() => tag(opts, '0.2.0', false)).toThrow('Working tree is dirty');
  });

  it('should throw when working tree is dirty after bump commit', () => {
    // bump reads: getVersion, getOpenClawVersion, root pkg, oc pkg, 2 manifests
    // tag reads: getVersion, getOpenClawVersion
    mockReadFileSync
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'))
      .mockReturnValueOnce(makePkgJson('0.1.0'))
      .mockReturnValueOnce(makeOcPkgJson('0.1.0'))
      .mockReturnValueOnce(makePluginManifest('0.1.0'))
      .mockReturnValueOnce(makePluginManifest('0.1.0'));

    mockExistsSync.mockReturnValue(true);

    let statusCallCount = 0;
    const opts = createMockOpts({
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'git status --porcelain') {
          statusCallCount++;
          // First call: clean (pre-bump), second call: dirty (post-commit)
          return statusCallCount === 1 ? '' : ' M unexpected-artifact';
        }
        if (cmd === 'git diff --name-only') return 'package.json';
        return '';
      }),
    });

    expect(() => tag(opts, '0.2.0', false)).toThrow('dirty after bump commit');
  });

  it('should reject invalid semver when version is provided', () => {
    const opts = createMockOpts();
    expect(() => tag(opts, 'invalid', false)).toThrow('Invalid semver: invalid');
  });
});

// ---------------------------------------------------------------------------
// main (CLI dispatch)
// ---------------------------------------------------------------------------

describe('main', () => {
  it('should show usage for unknown command', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    expect(() => main(['unknown'])).toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should show usage and exit 0 for no command', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    expect(() => main([])).toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = writeSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('Usage:');

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should throw for bump without version', () => {
    expect(() => main(['bump'])).toThrow('Usage: release.ts bump <version>');
  });

  it('should throw for bump with only --dry-run', () => {
    expect(() => main(['bump', '--dry-run'])).toThrow('Usage: release.ts bump <version>');
  });
});
