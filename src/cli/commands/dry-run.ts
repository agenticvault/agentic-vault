import { signDefiCall, type WorkflowContext } from '../../protocols/index.js';
import { parseOutputFormat, toJson, toHuman, resolveStdinFlag } from '../formatters.js';

export async function runDryRun(ctx: WorkflowContext, argv: string[]): Promise<void> {
  let chainId = 0;
  let to = '';
  let data = '';
  let value: string | undefined;
  const format = parseOutputFormat(argv);

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--chain-id': chainId = Number(argv[++i]); break;
      case '--to': to = argv[++i]; break;
      case '--data': data = argv[++i]; break;
      case '--value': value = argv[++i]; break;
    }
  }

  if (!chainId || !to || !data) {
    throw new Error('Usage: agentic-vault dry-run --chain-id <id> --to <address> --data <hex|-> [--value <wei>]');
  }

  data = await resolveStdinFlag(data);

  const result = await signDefiCall(ctx, 'dry-run', { chainId, to, data, value });

  switch (result.status) {
    case 'dry-run-approved':
      if (format === 'human') {
        const d = result.details as Record<string, unknown>;
        process.stdout.write(toHuman(d, 'Dry Run Result') + '\n');
      } else if (format === 'raw') {
        process.stdout.write(toJson(result.details, false) + '\n');
      } else {
        process.stdout.write(toJson(result.details) + '\n');
      }
      break;
    case 'denied':
      process.stderr.write(result.reason + '\n');
      process.exitCode = 1;
      break;
    case 'error':
      process.stderr.write(result.reason + '\n');
      process.exitCode = 1;
      break;
    default:
      process.stderr.write('Unexpected result\n');
      process.exitCode = 1;
  }
}
