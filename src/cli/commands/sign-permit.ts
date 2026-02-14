import { readFileSync } from 'node:fs';
import { signPermit, type WorkflowContext } from '../../protocols/index.js';
import { parseOutputFormat, toJson, toHuman } from '../formatters.js';

export async function runSignPermit(ctx: WorkflowContext, argv: string[]): Promise<void> {
  let chainId = 0;
  let token = '';
  let spender = '';
  let value = '';
  let deadline = 0;
  let payloadPath = '';
  let filePath = '';
  const format = parseOutputFormat(argv);

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--chain-id': chainId = Number(argv[++i]); break;
      case '--token': token = argv[++i]; break;
      case '--spender': spender = argv[++i]; break;
      case '--value': value = argv[++i]; break;
      case '--deadline': deadline = Number(argv[++i]); break;
      case '--payload': payloadPath = argv[++i]; break;
      case '--file': filePath = argv[++i]; break;
    }
  }

  // --file mode: extract all fields from a single JSON file
  if (filePath) {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    // Auto-extract fields with numeric coercion
    chainId = chainId || Number(raw.chainId ?? raw.domain?.chainId ?? 0);
    token = token || String(raw.token ?? raw.domain?.verifyingContract ?? '');
    spender = spender || String(raw.spender ?? raw.message?.spender ?? '');
    value = value || String(raw.value ?? raw.message?.value ?? '');
    deadline = deadline || Number(raw.deadline ?? raw.message?.deadline ?? 0);

    if (!chainId || !token || !spender || !value || !deadline) {
      throw new Error(
        'Permit file missing required fields. Expected: chainId, token/domain.verifyingContract, spender/message.spender, value/message.value, deadline/message.deadline',
      );
    }
    if (!raw.domain || !raw.types || !raw.message) {
      throw new Error('Permit file must contain domain, types, and message fields');
    }

    const result = await signPermit(ctx, {
      chainId,
      token,
      spender,
      value,
      deadline,
      domain: raw.domain,
      types: raw.types,
      message: raw.message,
    });

    writeResult(result, format);
    return;
  }

  // Legacy mode: explicit flags + --payload
  if (!chainId || !token || !spender || !value || !deadline || !payloadPath) {
    throw new Error(
      'Usage: agentic-vault sign-permit --file <permit.json>\n' +
      '   or: agentic-vault sign-permit --chain-id <id> --token <addr> --spender <addr> --value <wei> --deadline <ts> --payload <json-path>',
    );
  }

  const payload = JSON.parse(readFileSync(payloadPath, 'utf-8'));

  const result = await signPermit(ctx, {
    chainId,
    token,
    spender,
    value,
    deadline,
    domain: payload.domain,
    types: payload.types,
    message: payload.message,
  });

  writeResult(result, format);
}

function writeResult(
  result: { status: string; data?: string; reason?: string; details?: Record<string, unknown> },
  format: 'json' | 'human' | 'raw',
): void {
  switch (result.status) {
    case 'approved':
      if (format === 'json') {
        process.stdout.write(toJson({ status: 'approved', signature: result.data }) + '\n');
      } else if (format === 'human') {
        process.stdout.write(toHuman({ status: 'approved', signature: result.data ?? '' }, 'Permit Signature') + '\n');
      } else {
        process.stdout.write((result.data ?? '') + '\n');
      }
      break;
    case 'denied':
      process.stderr.write((result.reason ?? 'Denied') + '\n');
      process.exitCode = 1;
      break;
    case 'error':
      process.stderr.write((result.reason ?? 'Error') + '\n');
      process.exitCode = 1;
      break;
    default:
      process.stderr.write('Unexpected result\n');
      process.exitCode = 1;
  }
}
