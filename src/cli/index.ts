#!/usr/bin/env node

import { parseGlobalArgs, buildWorkflowContext, buildDryRunContext } from './context.js';
import { parseOutputFormat } from './formatters.js';
import { runSign } from './commands/sign.js';
import { runSignPermit } from './commands/sign-permit.js';
import { runDryRun } from './commands/dry-run.js';
import { runGetAddress } from './commands/get-address.js';
import { runHealth } from './commands/health.js';
import { runMcp } from './commands/mcp.js';
import { runDecode } from './commands/decode.js';
import { runEncode } from './commands/encode.js';

const USAGE = `Usage: agentic-vault <command> [options]

Commands:
  sign            Sign a DeFi transaction (decoded + policy validated)
  sign-permit     Sign an EIP-2612 permit
  dry-run         Decode + policy check without signing
  encode          Encode intent parameters into calldata hex
  decode          Decode calldata hex into intent JSON
  get-address     Get the vault wallet address
  health          Check signer health status
  mcp             Start MCP stdio server

Global options:
  --key-id <id>           AWS KMS key ID (or set VAULT_KEY_ID env var)
  --region <region>       AWS region (or set VAULT_REGION env var)
  --expected-address <a>  Expected wallet address (optional)
  --policy-config <path>  Policy config JSON file (optional)
  --output <format>       Output format: json (default), human, raw
  --help, -h              Show this help message
`;

function usage(exitCode = 1): never {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(USAGE);
  process.exit(exitCode);
}

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  const rest = process.argv.slice(3);

  if (subcommand === '--help' || subcommand === '-h') {
    usage(0);
  }

  if (!subcommand) {
    usage(1);
  }

  // Subcommand-level --help: show global usage (subcommand-specific help not yet implemented)
  if (rest.includes('--help') || rest.includes('-h')) {
    usage(0);
  }

  switch (subcommand) {
    case 'sign': {
      const args = parseGlobalArgs(rest);
      const ctx = buildWorkflowContext(args);
      await runSign(ctx, rest);
      break;
    }
    case 'sign-permit': {
      const args = parseGlobalArgs(rest);
      const ctx = buildWorkflowContext(args);
      await runSignPermit(ctx, rest);
      break;
    }
    case 'dry-run': {
      // dry-run does not require signer credentials, but supports --policy-config
      let policyConfig: string | undefined;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--policy-config') policyConfig = rest[++i];
      }
      const ctx = buildDryRunContext({ policyConfig });
      await runDryRun(ctx, rest);
      break;
    }
    case 'get-address': {
      const args = parseGlobalArgs(rest);
      const ctx = buildWorkflowContext(args);
      await runGetAddress(ctx, parseOutputFormat(rest));
      break;
    }
    case 'health': {
      const args = parseGlobalArgs(rest);
      const ctx = buildWorkflowContext(args);
      await runHealth(ctx, parseOutputFormat(rest));
      break;
    }
    case 'encode': {
      await runEncode(rest);
      break;
    }
    case 'decode': {
      await runDecode(rest);
      break;
    }
    case 'mcp': {
      const args = parseGlobalArgs(rest);
      await runMcp(args, rest);
      break;
    }
    default:
      usage();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
