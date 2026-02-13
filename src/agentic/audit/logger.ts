import { type AuditEntry } from './types.js';

export class AuditLogger {
  private readonly output: NodeJS.WritableStream;

  constructor(output?: NodeJS.WritableStream) {
    this.output = output ?? process.stderr;
  }

  log(entry: Omit<AuditEntry, 'timestamp' | 'traceId'>): AuditEntry {
    const full: AuditEntry = {
      timestamp: new Date().toISOString(),
      traceId: this.createTraceId(),
      ...entry,
    };
    this.output.write(JSON.stringify(full) + '\n');
    return full;
  }

  createTraceId(): string {
    return crypto.randomUUID();
  }
}
