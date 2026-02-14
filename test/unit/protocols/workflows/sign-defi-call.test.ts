import { describe, it, expect, vi } from 'vitest';
import { signDefiCall } from '@/protocols/workflows/sign-defi-call.js';
import type { WorkflowContext, WorkflowDecodedIntent } from '@/protocols/workflows/types.js';

// ============================================================================
// Helpers
// ============================================================================

function createMockIntent(overrides?: Partial<WorkflowDecodedIntent>): WorkflowDecodedIntent {
  return {
    protocol: 'erc20',
    action: 'approve',
    chainId: 1,
    to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    selector: '0x095ea7b3',
    args: { spender: '0x1111111111111111111111111111111111111111', amount: 100n },
    ...overrides,
  };
}

function createMockCtx(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8signed'),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditSink: { log: vi.fn() },
    dispatcher: { dispatch: vi.fn().mockReturnValue(createMockIntent()) },
    caller: 'mcp-client',
    ...overrides,
  };
}

const VALID_INPUT = {
  chainId: 1,
  to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  data: '0x095ea7b3',
};

// ============================================================================
// Tests
// ============================================================================

describe('signDefiCall workflow', () => {
  describe('dispatcher requirement', () => {
    it('should throw when dispatcher is missing', async () => {
      const ctx = createMockCtx({ dispatcher: undefined });
      await expect(signDefiCall(ctx, 'sign_defi_call', VALID_INPUT))
        .rejects.toThrow('sign_defi_call requires dispatcher in WorkflowContext');
    });
  });

  describe('unknown protocol rejection (fail-closed)', () => {
    it('should deny unknown protocols', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.dispatcher!.dispatch).mockReturnValue(
        createMockIntent({ protocol: 'unknown', reason: 'Unrecognized contract' }),
      );
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Rejected: Unrecognized contract');
    });

    it('should audit unknown protocol rejection', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.dispatcher!.dispatch).mockReturnValue(
        createMockIntent({ protocol: 'unknown', reason: 'No decoder' }),
      );
      await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(ctx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'denied', action: 'sign_defi_call' }),
      );
    });
  });

  describe('value parsing', () => {
    it('should return error for invalid value', async () => {
      const ctx = createMockCtx();
      const result = await signDefiCall(ctx, 'sign_defi_call', { ...VALID_INPUT, value: 'not-a-number' });
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'Invalid value: must be a decimal string');
    });

    it('should pass valid value to policy as bigint', async () => {
      const ctx = createMockCtx();
      await signDefiCall(ctx, 'sign_defi_call', { ...VALID_INPUT, value: '1000000' });
      expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ amountWei: 1000000n }),
      );
    });
  });

  describe('policy evaluation', () => {
    it('should deny when policy rejects', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.policyEngine.evaluate).mockReturnValue({
        allowed: false,
        violations: ['Exceeds daily limit'],
      });
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Policy denied: Exceeds daily limit');
    });

    it('should include violations array in denied result', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.policyEngine.evaluate).mockReturnValue({
        allowed: false,
        violations: ['Violation A', 'Violation B'],
      });
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result).toHaveProperty('violations', ['Violation A', 'Violation B']);
    });
  });

  describe('signing', () => {
    it('should sign and return approved result', async () => {
      const ctx = createMockCtx();
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result.status).toBe('approved');
      expect(result).toHaveProperty('data', '0x02f8signed');
    });

    it('should return error when signing fails', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.signer!.signTransaction).mockRejectedValue(new Error('KMS timeout'));
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'Signing error: KMS timeout');
    });

    it('should return error when signer is missing and not dry-run', async () => {
      const ctx = createMockCtx({ signer: undefined });
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'Signer is required when dryRun is not enabled');
    });
  });

  describe('audit logging', () => {
    it('should use ctx.caller in audit entries', async () => {
      const ctx = createMockCtx({ caller: 'cli' });
      await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(ctx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({ who: 'cli' }),
      );
    });

    it('should use custom service name when provided', async () => {
      const ctx = createMockCtx({ service: 'agentic-vault-mcp' });
      await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(ctx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'agentic-vault-mcp' }),
      );
    });

    it('should default service to agentic-vault', async () => {
      const ctx = createMockCtx();
      await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(ctx.auditSink.log).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'agentic-vault' }),
      );
    });
  });

  describe('dry-run mode', () => {
    it('should return dry-run-approved without signing', async () => {
      const ctx = createMockCtx({ dryRun: true });
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      expect(result.status).toBe('dry-run-approved');
      expect(result).toHaveProperty('details');
      expect(ctx.signer!.signTransaction).not.toHaveBeenCalled();
    });

    it('should include intent details in dry-run result', async () => {
      const ctx = createMockCtx({ dryRun: true });
      const result = await signDefiCall(ctx, 'sign_defi_call', VALID_INPUT);
      if (result.status !== 'dry-run-approved') throw new Error('Expected dry-run-approved');
      expect(result.details).toHaveProperty('protocol', 'erc20');
      expect(result.details).toHaveProperty('action', 'approve');
    });
  });
});
