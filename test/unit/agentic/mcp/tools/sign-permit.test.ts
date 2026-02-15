import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSignPermit } from '@/agentic/mcp/tools/sign-permit.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

// ============================================================================
// Types
// ============================================================================

type ToolHandlerResult = { content: { type: string; text: string }[]; isError?: boolean };

// ============================================================================
// Helpers
// ============================================================================

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8...signedtx'),
      signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc...', s: '0xdef...' }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditLogger: {
      log: vi.fn(),
    },
    ...overrides,
  };
}

function getToolHandler(server: McpServer, toolName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    { handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult> }
  >;
  return tools[toolName].handler;
}

/** Default valid permit args for reuse */
function createPermitArgs(overrides?: Record<string, unknown>) {
  return {
    chainId: 1,
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    value: '1000000000000000000',
    deadline: 1700000000,
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      value: '1000000000000000000',
      nonce: '0',
      deadline: '1700000000',
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('sign_permit tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  let handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSignPermit(server, ctx);
    handler = getToolHandler(server, 'sign_permit');
  });

  it('should register the sign_permit tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  describe('policy approval flow', () => {
    it('should call signer and return signed permit when policy approves with matching domain', async () => {
      const result = await handler(createPermitArgs());

      expect(ctx.policyEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          amountWei: 1000000000000000000n,
          deadline: 1700000000,
        }),
      );
      expect(ctx.signer.signTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryType: 'Permit',
        }),
      );
      expect(result.isError).toBeUndefined();

      const sig = JSON.parse(result.content[0].text);
      expect(sig).toEqual({ v: 27, r: '0xabc...', s: '0xdef...' });
    });

    it('should log approved audit entry when policy passes', async () => {
      await handler(createPermitArgs());

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_permit',
          result: 'approved',
          why: 'Permit signing approved by policy',
        }),
      );
    });
  });

  describe('policy denial flow', () => {
    it('should return error and NOT call signer when policy denies', async () => {
      ctx = createMockContext({
        policyEngine: {
          evaluate: vi.fn().mockReturnValue({
            allowed: false,
            violations: ['token not in allowed list'],
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignPermit(server, ctx);
      handler = getToolHandler(server, 'sign_permit');

      const result = await handler(createPermitArgs());

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(result.content[0].text).toContain('token not in allowed list');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should log denied audit entry when policy fails', async () => {
      ctx = createMockContext({
        policyEngine: {
          evaluate: vi.fn().mockReturnValue({
            allowed: false,
            violations: ['amount exceeds limit'],
          }),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignPermit(server, ctx);
      handler = getToolHandler(server, 'sign_permit');

      await handler(createPermitArgs());

      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_permit',
          result: 'denied',
          why: expect.stringContaining('amount exceeds limit'),
        }),
      );
    });
  });

  describe('domain mismatch validation (P0)', () => {
    it('should return Payload mismatch error when domain.verifyingContract differs from token', async () => {
      const args = createPermitArgs({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 1,
          verifyingContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT, not USDC
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Payload mismatch');
      expect(result.content[0].text).toContain('domain.verifyingContract does not match token');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_permit',
          result: 'denied',
          why: 'Payload/metadata consistency check failed',
        }),
      );
    });

    it('should return Payload mismatch error when domain.chainId differs from args.chainId', async () => {
      const args = createPermitArgs({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 137, // Polygon, but args.chainId is 1 (Ethereum)
          verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Payload mismatch');
      expect(result.content[0].text).toContain('domain.chainId does not match chainId');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_permit',
          result: 'denied',
          why: 'Payload/metadata consistency check failed',
        }),
      );
    });

    it('should reject when domain has no verifyingContract (required for replay protection)', async () => {
      const args = createPermitArgs({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 1,
          // no verifyingContract
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('domain must include verifyingContract and chainId');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should reject when domain has no chainId (required for replay protection)', async () => {
      const args = createPermitArgs({
        domain: {
          name: 'USD Coin',
          version: '2',
          verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          // no chainId
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('domain must include verifyingContract and chainId');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });
  });

  describe('types.Permit canonical schema validation', () => {
    it('should reject when types.Permit is missing', async () => {
      const args = createPermitArgs({
        types: {
          // no Permit field
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('types.Permit must be an array');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should reject when types.Permit omits policy-checked fields', async () => {
      const args = createPermitArgs({
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            // missing spender, value, deadline — not part of signed digest
          ],
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('spender');
      expect(result.content[0].text).toContain('value');
      expect(result.content[0].text).toContain('deadline');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });
  });

  describe('message-vs-args bypass prevention (Phase 5a)', () => {
    it('should reject when message.value differs from args.value', async () => {
      const args = createPermitArgs({
        value: '1000000000000000000', // 1 ETH in args (policy checks this)
        message: {
          owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
          value: '999000000000000000000', // 999 ETH in message (actually signed)
          nonce: '0',
          deadline: '1700000000',
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Payload mismatch');
      expect(result.content[0].text).toContain('message.value does not match value');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sign_permit',
          result: 'denied',
          why: 'Payload/metadata consistency check failed',
        }),
      );
    });

    it('should reject when message.spender differs from args.spender', async () => {
      const args = createPermitArgs({
        spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // legit spender in args
        message: {
          owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          spender: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', // attacker spender in message
          value: '1000000000000000000',
          nonce: '0',
          deadline: '1700000000',
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('message.spender does not match spender');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should reject when message.deadline differs from args.deadline', async () => {
      const args = createPermitArgs({
        deadline: 1700000000, // short deadline in args
        message: {
          owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
          value: '1000000000000000000',
          nonce: '0',
          deadline: '9999999999', // far future in message
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('message.deadline does not match deadline');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should pass when message fields match args (consistent payload)', async () => {
      const result = await handler(createPermitArgs());

      expect(result.isError).toBeUndefined();
      expect(ctx.signer.signTypedData).toHaveBeenCalled();
    });

    it('should reject when message omits required EIP-2612 fields (prevent bypass via omission)', async () => {
      const args = createPermitArgs({
        message: {
          owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          nonce: '0',
          // no value, spender, deadline — attacker omits policy-checked fields
        },
      });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('must include value, spender, and deadline');
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should compare spender case-insensitively', async () => {
      const args = createPermitArgs({
        spender: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        message: {
          owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          spender: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // lowercase
          value: '1000000000000000000',
          nonce: '0',
          deadline: '1700000000',
        },
      });

      const result = await handler(args);

      expect(result.isError).toBeUndefined();
      expect(ctx.signer.signTypedData).toHaveBeenCalled();
    });
  });

  describe('invalid value handling', () => {
    it('should return error for invalid value string', async () => {
      const args = createPermitArgs({ value: 'not-a-number' });

      const result = await handler(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Invalid value: must be a decimal string');
      expect(ctx.policyEngine.evaluate).not.toHaveBeenCalled();
      expect(ctx.signer.signTypedData).not.toHaveBeenCalled();
    });
  });

  describe('signing error handling', () => {
    it('should return error and log when signer throws', async () => {
      ctx = createMockContext({
        signer: {
          getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
          signTransaction: vi.fn(),
          signTypedData: vi.fn().mockRejectedValue(new Error('KMS throttled')),
          healthCheck: vi.fn(),
        },
      });
      server = new McpServer({ name: 'test', version: '0.0.1' });
      registerSignPermit(server, ctx);
      handler = getToolHandler(server, 'sign_permit');

      const result = await handler(createPermitArgs());

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Signing error: KMS throttled');
      expect(ctx.auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agentic-vault-mcp',
          action: 'sign_permit',
          result: 'error',
          details: expect.objectContaining({ error: 'KMS throttled' }),
        }),
      );
    });
  });
});
