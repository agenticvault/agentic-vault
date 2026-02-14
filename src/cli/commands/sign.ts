import { signDefiCall, ProtocolDispatcher, createDefaultRegistry, type WorkflowContext } from '../../protocols/index.js';
import { parseOutputFormat, toJson, toHuman, resolveStdinFlag, isTTY, confirmAction } from '../formatters.js';

export async function runSign(ctx: WorkflowContext, argv: string[]): Promise<void> {
  let chainId = 0;
  let to = '';
  let data = '';
  let value: string | undefined;
  let skipConfirm = false;
  const format = parseOutputFormat(argv);

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--chain-id': chainId = Number(argv[++i]); break;
      case '--to': to = argv[++i]; break;
      case '--data': data = argv[++i]; break;
      case '--value': value = argv[++i]; break;
      case '--yes': skipConfirm = true; break;
    }
  }

  if (!chainId || !to || !data) {
    throw new Error('Usage: agentic-vault sign --chain-id <id> --to <address> --data <hex|-> [--value <wei>] [--yes]');
  }

  data = await resolveStdinFlag(data);

  // TTY confirmation: show decoded intent before signing
  if (isTTY() && !skipConfirm) {
    const dispatcher = new ProtocolDispatcher(createDefaultRegistry());
    const intent = dispatcher.dispatch(chainId, to.toLowerCase() as `0x${string}`, data as `0x${string}`);
    process.stderr.write(`\nTransaction preview:\n`);
    process.stderr.write(`  Protocol: ${intent.protocol}\n`);
    if (intent.protocol !== 'unknown') {
      process.stderr.write(`  Action:   ${intent.action}\n`);
    }
    process.stderr.write(`  Chain:    ${chainId}\n`);
    process.stderr.write(`  To:       ${to}\n`);
    if (intent.protocol !== 'unknown') {
      for (const [k, v] of Object.entries(intent.args)) {
        process.stderr.write(`  ${k}: ${typeof v === 'bigint' ? v.toString() : v}\n`);
      }
    }
    const confirmed = await confirmAction('\nSign this transaction?');
    if (!confirmed) {
      process.stderr.write('Aborted.\n');
      process.exitCode = 1;
      return;
    }
  }

  const result = await signDefiCall(ctx, 'sign', { chainId, to, data, value });

  switch (result.status) {
    case 'approved':
      if (format === 'json') {
        process.stdout.write(toJson({ status: 'approved', signedTransaction: result.data, ...result.details }) + '\n');
      } else if (format === 'human') {
        process.stdout.write(toHuman({ status: 'approved', signedTransaction: result.data, ...result.details }, 'Sign Result') + '\n');
      } else {
        process.stdout.write(result.data + '\n');
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
