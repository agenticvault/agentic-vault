#!/usr/bin/env node

/**
 * Self-install script for @agenticvault/agentic-vault-openclaw.
 *
 * Copies plugin files to ~/.openclaw/extensions/agentic-vault-openclaw/,
 * installs runtime dependencies, and prints a config snippet.
 *
 * Usage:
 *   npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup
 */

import { existsSync, mkdirSync, cpSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Files/dirs to copy from the package root to the target directory. */
const COPY_ENTRIES = ['dist', 'openclaw.plugin.json', 'package.json', 'LICENSE'] as const;

/** Entries that must exist for a valid installation. */
const REQUIRED_ENTRIES: ReadonlySet<string> = new Set(['dist', 'openclaw.plugin.json', 'package.json']);

const EXTENSION_ID = 'agentic-vault-openclaw';

export interface InstallOptions {
  /** Override target directory (default: ~/.openclaw/extensions/agentic-vault-openclaw) */
  targetDir?: string;
  /** Override source directory (default: package root) */
  sourceDir?: string;
  /** Writer function for output (default: process.stdout.write) */
  write?: (msg: string) => void;
  /** Skip npm install (for testing) */
  skipNpmInstall?: boolean;
  /** Override platform detection (for testing) */
  _platform?: string;
}

export function resolveTargetDir(override?: string): string {
  if (override) return resolve(override);
  return join(homedir(), '.openclaw', 'extensions', EXTENSION_ID);
}

export function resolveSourceDir(override?: string): string {
  if (override) return resolve(override);
  // __dirname is dist/, package root is one level up
  return resolve(__dirname, '..');
}

export function copyPluginFiles(sourceDir: string, targetDir: string): string[] {
  const copied: string[] = [];

  for (const entry of COPY_ENTRIES) {
    const src = join(sourceDir, entry);
    if (!existsSync(src)) continue;

    const dest = join(targetDir, entry);
    cpSync(src, dest, { recursive: true, force: true });
    copied.push(entry);
  }

  return copied;
}

export function installDependencies(targetDir: string): void {
  execSync('npm install --omit=dev --ignore-scripts', {
    cwd: targetDir,
    stdio: 'pipe',
  });
}

export function generateConfigSnippet(): string {
  return JSON.stringify(
    {
      plugins: {
        allow: [EXTENSION_ID],
        entries: {
          [EXTENSION_ID]: {
            config: {
              keyId: '<your-kms-key-id-or-arn>',
              region: '<your-aws-region>',
            },
          },
        },
      },
    },
    null,
    2,
  );
}

export function run(options: InstallOptions = {}): void {
  const write = options.write ?? ((msg: string) => process.stdout.write(msg));
  const sourceDir = resolveSourceDir(options.sourceDir);
  const targetDir = resolveTargetDir(options.targetDir);

  const currentPlatform = options._platform ?? platform();
  if (currentPlatform === 'win32') {
    write('Error: Windows is not supported. Use WSL or a Unix-based system.\n');
    process.exitCode = 1;
    return;
  }

  write(`\nInstalling @agenticvault/agentic-vault-openclaw to ${targetDir}\n\n`);

  // 1. Create target directory
  mkdirSync(targetDir, { recursive: true });

  // 2. Copy plugin files
  write('Copying plugin files...\n');
  const copied = copyPluginFiles(sourceDir, targetDir);
  if (copied.length === 0) {
    write('Error: No plugin files found in source directory.\n');
    process.exitCode = 1;
    return;
  }
  for (const entry of copied) {
    write(`  ${entry}\n`);
  }

  // Verify required entries were copied
  const missingRequired = [...REQUIRED_ENTRIES].filter((e) => !copied.includes(e));
  if (missingRequired.length > 0) {
    write(`Error: Missing required files: ${missingRequired.join(', ')}\n`);
    process.exitCode = 1;
    return;
  }

  // 3. Install runtime dependencies
  if (!options.skipNpmInstall) {
    write('\nInstalling runtime dependencies...\n');
    try {
      installDependencies(targetDir);
      write('  Done.\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      write(`Error: Failed to install dependencies: ${msg}\n`);
      process.exitCode = 1;
      return;
    }
  }

  // 4. Print config snippet
  write('\nAdd the following to your OpenClaw config (~/.openclaw/config.json):\n\n');
  write(generateConfigSnippet());
  write('\n');

  // 5. Print next steps
  write('\nNext steps:\n');
  write('  1. Replace <your-kms-key-id-or-arn> with your AWS KMS key ID or ARN\n');
  write('  2. Replace <your-aws-region> with your AWS region (e.g. us-east-1)\n');
  write('  3. (Optional) Add policyConfigPath and rpcUrl to the config\n');
  write('  4. Restart the OpenClaw gateway\n\n');
}

// Run when executed directly (realpathSync resolves npx bin symlinks)
function safeRealpath(p: string): string {
  try {
    return resolve(realpathSync(p));
  } catch {
    return resolve(p);
  }
}

const resolvedArgv1 = process.argv[1] ? safeRealpath(process.argv[1]) : '';
const resolvedFilename = safeRealpath(__filename);

const isDirectRun =
  resolvedArgv1 !== '' &&
  (resolvedArgv1 === resolvedFilename ||
    resolvedArgv1 === safeRealpath(__filename.replace(/\.ts$/, '.js')));

if (isDirectRun) {
  run();
}
