import { ProtocolDispatcher, createDefaultRegistry } from '../../protocols/index.js';
import { parseOutputFormat, toJson, toHuman, resolveStdinFlag } from '../formatters.js';

export async function runDecode(argv: string[]): Promise<void> {
  let chainId = 0;
  let to = '';
  let data = '';
  const format = parseOutputFormat(argv);

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--chain-id': chainId = Number(argv[++i]); break;
      case '--to': to = argv[++i]; break;
      case '--data': data = argv[++i]; break;
    }
  }

  if (!chainId || !to || !data) {
    throw new Error(
      'Usage: agentic-vault decode --chain-id <id> --to <address> --data <hex|->',
    );
  }

  data = await resolveStdinFlag(data);

  const dispatcher = new ProtocolDispatcher(createDefaultRegistry());
  const intent = dispatcher.dispatch(
    chainId,
    to.toLowerCase() as `0x${string}`,
    data as `0x${string}`,
  );

  if (format === 'human') {
    const flat: Record<string, unknown> = {
      protocol: intent.protocol,
      chainId: intent.chainId,
      to: intent.to,
    };
    if (intent.protocol !== 'unknown') {
      flat.action = intent.action;
      for (const [k, v] of Object.entries(intent.args)) {
        flat[`args.${k}`] = typeof v === 'bigint' ? v.toString() : v;
      }
    } else {
      flat.reason = intent.reason;
    }
    process.stdout.write(toHuman(flat, 'Decoded Intent') + '\n');
  } else if (format === 'raw') {
    process.stdout.write(toJson(intent, false) + '\n');
  } else {
    process.stdout.write(toJson(intent) + '\n');
  }
}
