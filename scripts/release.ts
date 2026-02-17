#!/usr/bin/env npx tsx
/**
 * release.ts — Agentic Vault release script
 *
 * Usage:
 *   npx tsx scripts/release.ts preflight                   Check prerequisites
 *   npx tsx scripts/release.ts first-publish [--dry-run]   Manual first publish (one-time)
 *   npx tsx scripts/release.ts bump <version>              Bump version in package.json + plugin manifests
 *   npx tsx scripts/release.ts tag [--dry-run]             Create git tags and push
 *
 * Typical flow:
 *   First release:   preflight → first-publish
 *   Subsequent:      bump 0.2.0 → (git commit) → tag
 */

import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CORE_PKG = '@agenticvault/agentic-vault';
const OPENCLAW_PKG = '@agenticvault/openclaw';
const OPENCLAW_DIR = 'packages/openclaw-plugin';
const PLUGIN_MANIFESTS = ['.claude-plugin/plugin.json', `${OPENCLAW_DIR}/openclaw.plugin.json`];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecFn = (cmd: string, opts?: Omit<ExecSyncOptionsWithStringEncoding, 'encoding'>) => string;

export interface RunOptions {
  exec: ExecFn;
  rootDir: string;
  stdout: (msg: string) => void;
  stderr: (msg: string) => void;
}

interface PackageJson {
  name: string;
  version: string;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

interface PluginManifest {
  version: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

export function readPackageJson(filePath: string): PackageJson {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as PackageJson;
}

export function writePackageJson(filePath: string, pkg: PackageJson): void {
  writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
}

export function readPluginManifest(filePath: string): PluginManifest {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as PluginManifest;
}

export function writePluginManifest(filePath: string, manifest: PluginManifest): void {
  writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
}

export function isValidSemver(version: string): boolean {
  return /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$/.test(version);
}

/** Validate a string is safe for shell interpolation (alphanumeric, dash, dot, @, /) */
export function assertShellSafe(value: string, label: string): void {
  if (!/^[a-zA-Z0-9._@/~-]+$/.test(value)) {
    throw new Error(`Unsafe ${label}: ${value}`);
  }
}

export function exec(cmd: string, opts?: Omit<ExecSyncOptionsWithStringEncoding, 'encoding'>): string {
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
}

export function isGitClean(rootDir: string, run = exec): boolean {
  const status = run('git status --porcelain', { cwd: rootDir });
  return status === '';
}

export function getVersion(rootDir: string): string {
  return readPackageJson(resolve(rootDir, 'package.json')).version;
}

export function getOpenClawVersion(rootDir: string): string {
  return readPackageJson(resolve(rootDir, OPENCLAW_DIR, 'package.json')).version;
}

export function gitTagExists(tag: string, rootDir: string, run = exec): boolean {
  try {
    run(`git rev-parse --verify refs/tags/${tag}`, { cwd: rootDir });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------------

export function preflight(opts: RunOptions): void {
  const { exec: run, rootDir, stdout } = opts;

  stdout('── Preflight checks ──\n');

  // 1. Tools
  stdout('[info]  Checking tools...');
  const nodeVer = run('node -v');
  const npmVer = run('npm -v');
  const pnpmVer = run('pnpm -v');
  stdout(`[ok]    node ${nodeVer} | npm ${npmVer} | pnpm ${pnpmVer}`);

  // 2. npm login
  stdout('[info]  Checking npm auth...');
  try {
    const whoami = run('npm whoami');
    stdout(`[ok]    Logged in as: ${whoami}`);
  } catch {
    throw new Error('Not logged in to npm. Run: npm login --scope=@agenticvault');
  }

  // 3. Git clean
  stdout('[info]  Checking git status...');
  if (isGitClean(rootDir, run)) {
    stdout('[ok]    Working tree is clean');
  } else {
    stdout('[warn]  Working tree is dirty — commit or stash changes before publishing');
    const status = run('git status --short', { cwd: rootDir });
    stdout(status);
  }

  // 4. Versions
  const coreVer = getVersion(rootDir);
  const ocVer = getOpenClawVersion(rootDir);
  stdout(`[info]  Core version:     ${coreVer}`);
  stdout(`[info]  OpenClaw version: ${ocVer}`);

  // 5. Build + Test
  stdout('[info]  Running build...');
  run('pnpm build', { cwd: rootDir });
  stdout('[ok]    Build passed');

  stdout('[info]  Running lint...');
  run('pnpm lint', { cwd: rootDir });
  stdout('[ok]    Lint passed');

  stdout('[info]  Running unit tests (core)...');
  run('pnpm test:unit', { cwd: rootDir });
  stdout('[ok]    Core tests passed');

  stdout('[info]  Running unit tests (openclaw)...');
  run('pnpm test:unit', { cwd: resolve(rootDir, OPENCLAW_DIR) });
  stdout('[ok]    OpenClaw tests passed');

  // 6. Tarball verification
  stdout('\n── Tarball verification ──\n');

  stdout('[info]  Core package contents:');
  const corePack = run('pnpm pack --dry-run 2>&1', { cwd: rootDir });
  stdout(corePack);

  stdout('[info]  OpenClaw package contents:');
  const ocPack = run('pnpm pack --dry-run 2>&1', { cwd: resolve(rootDir, OPENCLAW_DIR) });
  stdout(ocPack);

  stdout('\n── Preflight complete ──\n');
  stdout(`[ok]    All checks passed. Ready to publish.`);
  stdout(`[info]  Core:     ${CORE_PKG}@${coreVer}`);
  stdout(`[info]  OpenClaw: ${OPENCLAW_PKG}@${ocVer}`);
}

// ---------------------------------------------------------------------------
// first-publish
// ---------------------------------------------------------------------------

export function firstPublish(opts: RunOptions, dryRun: boolean): void {
  const { exec: run, rootDir, stdout } = opts;

  stdout('── First publish (manual) ──\n');

  const coreVer = getVersion(rootDir);
  const ocVer = getOpenClawVersion(rootDir);
  assertShellSafe(coreVer, 'core version');
  assertShellSafe(ocVer, 'openclaw version');

  stdout(`[info]  Core:     ${CORE_PKG}@${coreVer}`);
  stdout(`[info]  OpenClaw: ${OPENCLAW_PKG}@${ocVer}`);

  if (dryRun) {
    stdout('[warn]  DRY RUN — no packages will be published');
  }

  // Build first
  stdout('[info]  Building...');
  run('pnpm build', { cwd: rootDir });
  stdout('[ok]    Build complete');

  // Publish core (no dynamic interpolation — publishConfig in package.json handles scope)
  stdout(`\n── Publishing ${CORE_PKG}@${coreVer} ──\n`);

  if (dryRun) {
    stdout('[info]  [dry-run] npm publish --access public');
    run('npm publish --access public --dry-run', { cwd: rootDir });
  } else {
    run('npm publish --access public', { cwd: rootDir });
    stdout(`[ok]    Published ${CORE_PKG}@${coreVer}`);
  }

  // Publish openclaw (pnpm pack to resolve workspace:*)
  stdout(`\n── Publishing ${OPENCLAW_PKG}@${ocVer} ──\n`);

  const ocDir = resolve(rootDir, OPENCLAW_DIR);

  // Clean stale tarballs before packing
  cleanupTarballs(ocDir);

  stdout('[info]  Creating tarball (resolves workspace:* protocol)...');
  run('pnpm pack', { cwd: ocDir });

  // Find the generated tarball and validate filename is safe for shell
  const tarball = findTarball(ocDir);
  if (!tarball) {
    throw new Error(`No .tgz file found in ${OPENCLAW_DIR}`);
  }
  assertShellSafe(basename(tarball), 'tarball filename');

  stdout(`[info]  Tarball: ${basename(tarball)}`);

  // Use basename + cwd to avoid interpolating full filesystem path into shell command
  const tarballName = basename(tarball);
  if (dryRun) {
    stdout(`[info]  [dry-run] npm publish ${tarballName} --access public`);
    run(`npm publish ${tarballName} --access public --dry-run`, { cwd: ocDir });
  } else {
    run(`npm publish ${tarballName} --access public`, { cwd: ocDir });
    stdout(`[ok]    Published ${OPENCLAW_PKG}@${ocVer}`);
  }

  // Cleanup tarball
  cleanupTarballs(ocDir);

  // Verify
  if (!dryRun) {
    stdout('\n── Verifying on npm registry ──\n');
    stdout('[info]  Waiting for registry propagation...');

    try {
      const verifiedCore = run(`npm view ${CORE_PKG}@${coreVer} version`);
      stdout(`[ok]    ${CORE_PKG}@${verifiedCore} exists on npm`);
    } catch {
      stdout(`[warn]  ${CORE_PKG}@${coreVer} not yet visible (propagation may take a minute)`);
    }

    try {
      const verifiedOc = run(`npm view ${OPENCLAW_PKG}@${ocVer} version`);
      stdout(`[ok]    ${OPENCLAW_PKG}@${verifiedOc} exists on npm`);
    } catch {
      stdout(`[warn]  ${OPENCLAW_PKG}@${ocVer} not yet visible (propagation may take a minute)`);
    }
  }

  stdout('\n── First publish complete ──\n');
  stdout('[info]  Next steps:');
  stdout(`  1. Verify on npmjs.com`);
  stdout(`  2. Configure Trusted Publisher for each package`);
  stdout(`  3. Future releases: npx tsx scripts/release.ts bump <version> → git commit → npx tsx scripts/release.ts tag`);
}

// ---------------------------------------------------------------------------
// bump
// ---------------------------------------------------------------------------

export function bump(opts: RunOptions, newVersion: string): void {
  const { exec: run, rootDir, stdout } = opts;

  if (!isValidSemver(newVersion)) {
    throw new Error(`Invalid semver: ${newVersion}`);
  }

  const oldCoreVer = getVersion(rootDir);
  const oldOcVer = getOpenClawVersion(rootDir);
  const peerRange = `~${newVersion}`;

  stdout(`── Version bump: ${oldCoreVer} → ${newVersion} ──\n`);

  // 1. Root package.json
  const rootPkgPath = resolve(rootDir, 'package.json');
  stdout(`[info]  Updating ${rootPkgPath}`);
  const rootPkg = readPackageJson(rootPkgPath);
  rootPkg.version = newVersion;
  writePackageJson(rootPkgPath, rootPkg);
  stdout(`[ok]    Root: ${oldCoreVer} → ${newVersion}`);

  // 2. OpenClaw package.json (version + peerDep)
  const ocPkgPath = resolve(rootDir, OPENCLAW_DIR, 'package.json');
  stdout(`[info]  Updating ${ocPkgPath}`);
  const ocPkg = readPackageJson(ocPkgPath);
  ocPkg.version = newVersion;
  if (ocPkg.peerDependencies?.[CORE_PKG]) {
    ocPkg.peerDependencies[CORE_PKG] = peerRange;
  }
  writePackageJson(ocPkgPath, ocPkg);
  stdout(`[ok]    OpenClaw: ${oldOcVer} → ${newVersion} (peerDep: ${peerRange})`);

  // 3. Plugin manifests (version field only)
  const updatedManifests: string[] = [];
  for (const relPath of PLUGIN_MANIFESTS) {
    const absPath = resolve(rootDir, relPath);
    if (!existsSync(absPath)) {
      stdout(`[skip]  ${relPath} not found`);
      continue;
    }
    const manifest = readPluginManifest(absPath);
    const oldVer = manifest.version;
    manifest.version = newVersion;
    writePluginManifest(absPath, manifest);
    updatedManifests.push(relPath);
    stdout(`[ok]    ${relPath}: ${oldVer} → ${newVersion}`);
  }

  // 4. Regenerate lockfile (lockfile-only prevents unrelated dependency drift)
  stdout('[info]  Regenerating pnpm-lock.yaml...');
  run('pnpm install --lockfile-only', { cwd: rootDir });
  stdout('[ok]    Lockfile updated');

  // 5. Quick verify
  stdout('[info]  Quick verify: build + test...');
  run('pnpm build', { cwd: rootDir });
  run('pnpm test:unit', { cwd: rootDir });
  stdout('[ok]    Build + tests pass');

  stdout('\n── Bump complete ──\n');
  const changed = run('git diff --name-only', { cwd: rootDir });
  stdout('[info]  Changed files:');
  stdout(changed);
  stdout('[info]  Next steps:');
  const addFiles = [`package.json`, `${OPENCLAW_DIR}/package.json`, ...updatedManifests, `pnpm-lock.yaml`];
  stdout(`  git add ${addFiles.join(' ')}`);
  stdout(`  git commit -m "chore: bump version to ${newVersion}"`);
  stdout(`  npx tsx scripts/release.ts tag`);
}

// ---------------------------------------------------------------------------
// tag
// ---------------------------------------------------------------------------

export function tag(opts: RunOptions, dryRun: boolean): void {
  const { exec: run, rootDir, stdout } = opts;

  const coreVer = getVersion(rootDir);
  const ocVer = getOpenClawVersion(rootDir);
  assertShellSafe(coreVer, 'core version');
  assertShellSafe(ocVer, 'openclaw version');
  const coreTag = `v${coreVer}`;
  const ocTag = `openclaw-v${ocVer}`;

  stdout('── Create release tags ──\n');
  stdout(`[info]  Core:     ${coreTag}`);
  stdout(`[info]  OpenClaw: ${ocTag}`);

  // Check git is clean
  if (!isGitClean(rootDir, run)) {
    throw new Error('Working tree is dirty. Commit all changes before tagging.');
  }

  // Check tags don't already exist
  const existing: string[] = [];
  if (gitTagExists(coreTag, rootDir, run)) existing.push(coreTag);
  if (gitTagExists(ocTag, rootDir, run)) existing.push(ocTag);

  if (existing.length > 0) {
    throw new Error(`Tags already exist: ${existing.join(', ')}. Bump version first.`);
  }

  if (dryRun) {
    stdout('[warn]  DRY RUN — no tags will be created');
    stdout(`[info]  [dry-run] git tag -a ${coreTag} -m "Release ${CORE_PKG}@${coreVer}"`);
    stdout(`[info]  [dry-run] git tag -a ${ocTag} -m "Release ${OPENCLAW_PKG}@${ocVer}"`);
    stdout(`[info]  [dry-run] git push origin ${coreTag} ${ocTag}`);
    return;
  }

  // Create tags
  run(`git tag -a ${coreTag} -m "Release ${CORE_PKG}@${coreVer}"`, { cwd: rootDir });
  stdout(`[ok]    Created tag: ${coreTag}`);

  run(`git tag -a ${ocTag} -m "Release ${OPENCLAW_PKG}@${ocVer}"`, { cwd: rootDir });
  stdout(`[ok]    Created tag: ${ocTag}`);

  // Push tags
  stdout('[info]  Pushing tags...');
  run(`git push origin ${coreTag} ${ocTag}`, { cwd: rootDir });
  stdout('[ok]    Pushed tags');

  stdout('\n── Tags created ──\n');
  stdout('[info]  GitHub Actions will now run:');
  stdout(`  ${coreTag} → .github/workflows/release.yml`);
  stdout(`  ${ocTag}   → .github/workflows/release-openclaw.yml`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function findTarball(dir: string): string | null {
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.tgz'));
    return files.length > 0 ? resolve(dir, files[0]) : null;
  } catch {
    return null;
  }
}

export function cleanupTarballs(dir: string): void {
  try {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.tgz'))) {
      unlinkSync(resolve(dir, file));
    }
  } catch {
    // ignore cleanup errors
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const USAGE = `Agentic Vault Release Script

Usage: npx tsx scripts/release.ts <command> [options]

Commands:
  preflight              Check prerequisites (npm login, build, tests)
  first-publish          Manual first publish to npm (one-time, no provenance)
  bump <version>         Bump version in package.json files + plugin manifests
  tag                    Create git tags and push (triggers GHA workflows)

Options:
  --dry-run              Preview without side effects

Workflows:

  First release:
    1. npx tsx scripts/release.ts preflight
    2. npx tsx scripts/release.ts first-publish
    3. Configure Trusted Publisher on npmjs.com

  Subsequent releases:
    1. npx tsx scripts/release.ts bump 0.2.0
    2. git add -A && git commit -m 'chore: bump version to 0.2.0'
    3. npx tsx scripts/release.ts tag
`;

export function main(argv: string[] = process.argv.slice(2)): void {
  const command = argv[0];
  const rest = argv.slice(1);
  const dryRun = rest.includes('--dry-run');

  const opts: RunOptions = {
    exec,
    rootDir: ROOT_DIR,
    stdout: (msg) => process.stdout.write(msg + '\n'),
    stderr: (msg) => process.stderr.write(msg + '\n'),
  };

  switch (command) {
    case 'preflight':
      preflight(opts);
      break;
    case 'first-publish':
      firstPublish(opts, dryRun);
      break;
    case 'bump': {
      const version = rest.find((arg) => arg !== '--dry-run');
      if (!version) {
        throw new Error('Usage: release.ts bump <version> (e.g., 0.2.0)');
      }
      bump(opts, version);
      break;
    }
    case 'tag':
      tag(opts, dryRun);
      break;
    default:
      process.stdout.write(USAGE);
      process.exit(command ? 1 : 0);
      break;
  }
}

// Run if executed directly
const isDirectRun = process.argv[1]?.endsWith('release.ts');
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[fail]  ${message}\n`);
    process.exit(1);
  }
}
