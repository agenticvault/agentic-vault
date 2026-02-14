import { encodeFunctionData, type Abi } from 'viem';
import { ACTION_CATALOG, listActions } from '../../protocols/index.js';
import { parseOutputFormat, toJson, toHuman } from '../formatters.js';

export async function runEncode(argv: string[]): Promise<void> {
  const format = parseOutputFormat(argv);
  const actionKey = argv[0];

  if (!actionKey || actionKey.startsWith('--')) {
    throw new Error(
      `Usage: agentic-vault encode <protocol:action> [--param value ...]\n\nAvailable actions:\n  ${listActions().join('\n  ')}`,
    );
  }

  const entry = ACTION_CATALOG[actionKey];
  if (!entry) {
    throw new Error(
      `Unknown action: ${actionKey}\n\nAvailable actions:\n  ${listActions().join('\n  ')}`,
    );
  }

  // Parse named parameters from argv
  const params: Record<string, string> = {};
  for (let i = 1; i < argv.length; i++) {
    const flag = argv[i];
    if (flag.startsWith('--')) {
      const name = flag.slice(2);
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Missing value for --${name}`);
      }
      params[name] = value;
    }
  }

  // Validate required params
  const missing = entry.paramNames.filter((name) => !(name in params));
  if (missing.length > 0) {
    throw new Error(
      `Missing required parameters: ${missing.map((n) => `--${n}`).join(', ')}\n\n` +
      `Usage: agentic-vault encode ${actionKey} ${entry.paramNames.map((n) => `--${n} <${n}>`).join(' ')}`,
    );
  }

  // Build args in the correct order, coercing types
  const isTupleAction = entry.abi[0].inputs.length === 1 &&
    entry.abi[0].inputs[0].type === 'tuple';

  let args: unknown[];

  if (isTupleAction) {
    // Tuple-based actions (e.g., uniswap_v3:exactInputSingle) — wrap in struct
    const struct: Record<string, unknown> = {};
    for (let j = 0; j < entry.paramNames.length; j++) {
      struct[entry.paramNames[j]] = coerceValue(params[entry.paramNames[j]], entry.paramTypes[j]);
    }
    args = [struct];
  } else {
    // Flat actions (e.g., erc20:approve) — positional args
    args = entry.paramNames.map((name, j) =>
      coerceValue(params[name], entry.paramTypes[j]),
    );
  }

  // Cast to loose Abi type for dynamic encoding
  const calldata = encodeFunctionData({
    abi: entry.abi as unknown as Abi,
    functionName: entry.action,
    args,
  });

  if (format === 'json') {
    process.stdout.write(toJson({ action: actionKey, calldata }) + '\n');
  } else if (format === 'human') {
    process.stdout.write(toHuman({ action: actionKey, selector: entry.selector, calldata }, 'Encoded Calldata') + '\n');
  } else {
    process.stdout.write(calldata + '\n');
  }
}

function coerceValue(value: string, solidityType: string): unknown {
  if (solidityType === 'address') {
    return value as `0x${string}`;
  }
  if (solidityType.startsWith('uint') || solidityType.startsWith('int')) {
    return BigInt(value);
  }
  if (solidityType === 'bool') {
    return value === 'true';
  }
  return value;
}
