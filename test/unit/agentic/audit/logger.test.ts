import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogger } from '@/agentic/audit/logger.js';
import { type AuditEntry } from '@/agentic/audit/types.js';
import { Writable } from 'node:stream';

// ============================================================================
// Helpers
// ============================================================================

function createCapturingStream(): { stream: NodeJS.WritableStream; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { stream, lines };
}

// ============================================================================
// Tests
// ============================================================================

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  describe('log', () => {
    it('should output valid JSON format', () => {
      const { stream, lines } = createCapturingStream();
      const logger = new AuditLogger(stream);

      logger.log({
        service: 'agentic-vault-mcp',
        action: 'get_address',
        who: 'test-agent',
        what: 'Retrieved address',
        why: 'Test',
        result: 'approved',
      });

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0].trimEnd());
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });

    it('should include ISO 8601 timestamp', () => {
      const { stream, lines } = createCapturingStream();
      const logger = new AuditLogger(stream);

      logger.log({
        service: 'agentic-vault-mcp',
        action: 'test',
        who: 'test',
        what: 'test',
        why: 'test',
        result: 'approved',
      });

      const parsed: AuditEntry = JSON.parse(lines[0].trimEnd());
      expect(parsed.timestamp).toBe('2026-01-15T12:00:00.000Z');
      // Verify it's valid ISO 8601
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });

    it('should include a UUID v4 format traceId', () => {
      const { stream, lines } = createCapturingStream();
      const logger = new AuditLogger(stream);

      logger.log({
        service: 'agentic-vault-mcp',
        action: 'test',
        who: 'test',
        what: 'test',
        why: 'test',
        result: 'approved',
      });

      const parsed: AuditEntry = JSON.parse(lines[0].trimEnd());
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
      expect(parsed.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('should include all required fields', () => {
      const { stream, lines } = createCapturingStream();
      const logger = new AuditLogger(stream);

      logger.log({
        service: 'agentic-vault-mcp',
        action: 'sign_swap',
        who: 'agent-123',
        what: 'Signed swap transaction',
        why: 'User requested swap',
        result: 'approved',
        details: { chainId: 1 },
      });

      const parsed: AuditEntry = JSON.parse(lines[0].trimEnd());
      expect(parsed.service).toBe('agentic-vault-mcp');
      expect(parsed.action).toBe('sign_swap');
      expect(parsed.who).toBe('agent-123');
      expect(parsed.what).toBe('Signed swap transaction');
      expect(parsed.why).toBe('User requested swap');
      expect(parsed.result).toBe('approved');
      expect(parsed.details).toEqual({ chainId: 1 });
    });

    it('should not include secrets in output', () => {
      const { stream, lines } = createCapturingStream();
      const logger = new AuditLogger(stream);

      logger.log({
        service: 'agentic-vault-mcp',
        action: 'test',
        who: 'test',
        what: 'test',
        why: 'test',
        result: 'approved',
      });

      const line = lines[0];
      // Should not contain typical secret patterns
      expect(line).not.toMatch(/privateKey/i);
      expect(line).not.toMatch(/mnemonic/i);
      expect(line).not.toMatch(/secret/i);
      expect(line).not.toMatch(/password/i);
    });

    it('should return the full audit entry', () => {
      const { stream } = createCapturingStream();
      const logger = new AuditLogger(stream);

      const entry = logger.log({
        service: 'agentic-vault-mcp',
        action: 'test',
        who: 'test',
        what: 'test',
        why: 'test',
        result: 'denied',
      });

      expect(entry.timestamp).toBe('2026-01-15T12:00:00.000Z');
      expect(entry.traceId).toBeDefined();
      expect(entry.result).toBe('denied');
    });
  });

  describe('createTraceId', () => {
    it('should generate a UUID v4 format string', () => {
      const { stream } = createCapturingStream();
      const logger = new AuditLogger(stream);

      const traceId = logger.createTraceId();
      expect(traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('should generate unique IDs', () => {
      const { stream } = createCapturingStream();
      const logger = new AuditLogger(stream);

      const id1 = logger.createTraceId();
      const id2 = logger.createTraceId();
      expect(id1).not.toBe(id2);
    });
  });
});
