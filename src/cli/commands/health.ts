import { healthCheckWorkflow, type WorkflowContext } from '../../protocols/index.js';
import { type OutputFormat, toJson, toHuman } from '../formatters.js';

export async function runHealth(ctx: WorkflowContext, format: OutputFormat = 'json'): Promise<void> {
  const result = await healthCheckWorkflow(ctx);

  switch (result.status) {
    case 'approved':
      if (format === 'json') {
        process.stdout.write(toJson({ status: 'healthy' }) + '\n');
      } else if (format === 'human') {
        process.stdout.write(toHuman({ status: 'healthy' }, 'Health Check') + '\n');
      } else {
        process.stdout.write('healthy\n');
      }
      break;
    case 'error':
      process.stderr.write(toJson({ status: 'unhealthy', error: result.reason }) + '\n');
      process.exitCode = 1;
      break;
    default:
      process.stderr.write(toJson({ status: 'unhealthy', error: 'Unexpected result' }) + '\n');
      process.exitCode = 1;
  }
}
