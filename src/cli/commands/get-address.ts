import { getAddressWorkflow, type WorkflowContext } from '../../protocols/index.js';
import { type OutputFormat, toJson, toHuman } from '../formatters.js';

export async function runGetAddress(ctx: WorkflowContext, format: OutputFormat = 'json'): Promise<void> {
  const result = await getAddressWorkflow(ctx);

  switch (result.status) {
    case 'approved':
      if (format === 'json') {
        process.stdout.write(toJson({ address: result.data }) + '\n');
      } else if (format === 'human') {
        process.stdout.write(toHuman({ address: result.data }, 'Wallet Address') + '\n');
      } else {
        process.stdout.write(result.data + '\n');
      }
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
