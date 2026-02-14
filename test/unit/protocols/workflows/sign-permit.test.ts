import { describe, it, expect, vi } from 'vitest';
import { signPermit } from '@/protocols/workflows/sign-permit.js';
import type { WorkflowContext } from '@/protocols/workflows/types.js';
import type { SignPermitInput } from '@/protocols/workflows/sign-permit.js';

// ============================================================================
// Helpers
// ============================================================================

const TOKEN = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const SPENDER = '0x1111111111111111111111111111111111111111';

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
    caller: 'mcp-client',
    ...overrides,
  };
}

function validInput(overrides?: Partial<SignPermitInput>): SignPermitInput {
  return {
    chainId: 1,
    token: TOKEN,
    spender: SPENDER,
    value: '1000000',
    deadline: 1700000000,
    domain: { verifyingContract: TOKEN, chainId: 1, name: 'USDC', version: '1' },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: { owner: '0xowner', spender: SPENDER, value: '1000000', nonce: 0, deadline: 1700000000 },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('signPermit workflow', () => {
  describe('input object guards', () => {
    it('should reject null domain', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ domain: null as unknown as Record<string, unknown> }));
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'domain must be a non-null object');
    });

    it('should reject null message', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ message: null as unknown as Record<string, unknown> }));
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'message must be a non-null object');
    });

    it('should reject null types', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ types: null as unknown as Record<string, unknown> }));
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'types must be a non-null object');
    });
  });

  describe('value parsing', () => {
    it('should reject invalid value', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ value: 'abc' }));
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'Invalid value: must be a decimal string');
    });
  });

  describe('policy evaluation', () => {
    it('should deny when policy rejects', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.policyEngine.evaluate).mockReturnValue({
        allowed: false,
        violations: ['Max amount exceeded'],
      });
      const result = await signPermit(ctx, validInput());
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Policy denied: Max amount exceeded');
    });
  });

  describe('canonical types.Permit validation', () => {
    it('should deny when types.Permit is missing', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ types: {} }));
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'types.Permit must be an array of EIP-712 field definitions');
    });

    it('should deny when types.Permit is not an array', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ types: { Permit: 'wrong' } }));
      expect(result.status).toBe('denied');
    });

    it('should deny when canonical fields are missing from types.Permit', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({
        types: { Permit: [{ name: 'owner', type: 'address' }] },
      }));
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', expect.stringContaining('missing'));
    });
  });

  describe('message field validation', () => {
    it('should deny when message.value is null', async () => {
      const ctx = createMockCtx();
      const input = validInput();
      input.message = { ...input.message, value: null as unknown as string };
      const result = await signPermit(ctx, input);
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Permit message must include value, spender, and deadline fields');
    });

    it('should deny when message.spender is missing', async () => {
      const ctx = createMockCtx();
      const input = validInput();
      delete (input.message as Record<string, unknown>).spender;
      const result = await signPermit(ctx, input);
      expect(result.status).toBe('denied');
    });
  });

  describe('payload/metadata consistency', () => {
    it('should deny when message.value mismatches input.value', async () => {
      const ctx = createMockCtx();
      const input = validInput();
      input.message = { ...input.message, value: '9999999' };
      const result = await signPermit(ctx, input);
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Payload mismatch: message.value does not match value');
    });

    it('should deny when message.spender mismatches input.spender', async () => {
      const ctx = createMockCtx();
      const input = validInput();
      input.message = { ...input.message, spender: '0xdead' };
      const result = await signPermit(ctx, input);
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Payload mismatch: message.spender does not match spender');
    });

    it('should deny when message.deadline mismatches input.deadline', async () => {
      const ctx = createMockCtx();
      const input = validInput();
      input.message = { ...input.message, deadline: 9999 };
      const result = await signPermit(ctx, input);
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Payload mismatch: message.deadline does not match deadline');
    });
  });

  describe('domain validation', () => {
    it('should deny when domain.verifyingContract is missing', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({ domain: { chainId: 1 } }));
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Permit domain must include verifyingContract and chainId');
    });

    it('should deny when domain.verifyingContract mismatches token', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({
        domain: { verifyingContract: '0xdead', chainId: 1 },
      }));
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Payload mismatch: domain.verifyingContract does not match token');
    });

    it('should deny when domain.chainId mismatches input.chainId', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput({
        domain: { verifyingContract: TOKEN, chainId: 999 },
      }));
      expect(result.status).toBe('denied');
      expect(result).toHaveProperty('reason', 'Payload mismatch: domain.chainId does not match chainId');
    });
  });

  describe('signing', () => {
    it('should sign and return approved with JSON signature', async () => {
      const ctx = createMockCtx();
      const result = await signPermit(ctx, validInput());
      expect(result.status).toBe('approved');
      if (result.status !== 'approved') throw new Error('Expected approved');
      const parsed = JSON.parse(result.data);
      expect(parsed).toHaveProperty('v', 27);
      expect(parsed).toHaveProperty('r', '0xabc');
      expect(parsed).toHaveProperty('s', '0xdef');
    });

    it('should return error when signing fails', async () => {
      const ctx = createMockCtx();
      vi.mocked(ctx.signer!.signTypedData).mockRejectedValue(new Error('KMS error'));
      const result = await signPermit(ctx, validInput());
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'Signing error: KMS error');
    });

    it('should return error when signer is missing and not dry-run', async () => {
      const ctx = createMockCtx({ signer: undefined });
      const result = await signPermit(ctx, validInput());
      expect(result.status).toBe('error');
      expect(result).toHaveProperty('reason', 'Signer is required when dryRun is not enabled');
    });
  });

  describe('dry-run mode', () => {
    it('should return dry-run-approved without signing', async () => {
      const ctx = createMockCtx({ dryRun: true });
      const result = await signPermit(ctx, validInput());
      expect(result.status).toBe('dry-run-approved');
      expect(ctx.signer!.signTypedData).not.toHaveBeenCalled();
    });

    it('should include permit details in dry-run result', async () => {
      const ctx = createMockCtx({ dryRun: true });
      const result = await signPermit(ctx, validInput());
      if (result.status !== 'dry-run-approved') throw new Error('Expected dry-run-approved');
      expect(result.details).toHaveProperty('token', TOKEN.toLowerCase());
      expect(result.details).toHaveProperty('spender', SPENDER);
    });
  });
});
