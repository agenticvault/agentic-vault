import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { encodeFunctionData, type Address } from 'viem';
import { createMcpServer } from '@/agentic/mcp/server.js';
import { PolicyEngine, erc20Evaluator } from '@/protocols/index.js';
import type { PolicyConfigV2 } from '@/protocols/index.js';
import { AuditLogger } from '@/agentic/audit/logger.js';
import { LocalEvmSigner, HARDHAT_0_ADDRESS } from '../helpers/local-signer.js';
import { Writable } from 'node:stream';

// ============================================================================
// Constants
// ============================================================================

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const SPENDER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;

const erc20Abi = [
  {
    name: 'approve',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'spender', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
] as const;

const TEST_POLICY: PolicyConfigV2 = {
  allowedChainIds: [1],
  allowedContracts: [USDC.toLowerCase() as `0x${string}`],
  allowedSelectors: ['0x095ea7b3'],
  maxAmountWei: 10n ** 18n,
  maxDeadlineSeconds: 3600,
  protocolPolicies: {
    erc20: {
      tokenAllowlist: [USDC.toLowerCase() as Address],
      recipientAllowlist: [SPENDER.toLowerCase() as Address],
      maxAllowanceWei: 10n ** 18n,
    },
  },
};

// ============================================================================
// Tests: Full MCP protocol flow — NO mocks
// ============================================================================

describe('MCP server E2E (InMemoryTransport + LocalEvmSigner)', () => {
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    const signer = new LocalEvmSigner();
    const policyEngine = new PolicyEngine(TEST_POLICY, [erc20Evaluator]);
    // Discard audit output in E2E tests
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    const auditLogger = new AuditLogger(sink);

    server = createMcpServer({ signer, policyEngine, auditLogger });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'e2e-test', version: '1.0.0' });

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  // --- Tool discovery ---

  describe('tool discovery', () => {
    it('should list safe tools only (no sign_transaction/sign_typed_data)', async () => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);

      expect(names).toContain('get_address');
      expect(names).toContain('health_check');
      expect(names).toContain('sign_swap');
      expect(names).toContain('sign_permit');
      expect(names).not.toContain('sign_transaction');
      expect(names).not.toContain('sign_typed_data');
      expect(names).toHaveLength(4);
    });
  });

  // --- get_address ---

  describe('get_address', () => {
    it('should return Hardhat #0 address', async () => {
      const result = await client.callTool({ name: 'get_address', arguments: {} });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toBe(HARDHAT_0_ADDRESS);
    });
  });

  // --- health_check ---

  describe('health_check', () => {
    it('should return healthy status', async () => {
      const result = await client.callTool({ name: 'health_check', arguments: {} });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(JSON.parse(text)).toEqual({ status: 'healthy' });
    });
  });

  // --- sign_swap ---

  describe('sign_swap', () => {
    it('should return signed transaction when policy approves', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 500000000000000000n],
      });

      const result = await client.callTool({
        name: 'sign_swap',
        arguments: {
          chainId: 1,
          to: USDC,
          data,
          value: '500000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      // Real signed tx starts with 0x02 (EIP-1559)
      expect(text).toMatch(/^0x02f8/);
      expect(result.isError).toBeFalsy();
    });

    it('should return policy denied error for unauthorized contract', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const result = await client.callTool({
        name: 'sign_swap',
        arguments: {
          chainId: 1,
          to: '0x0000000000000000000000000000000000000bad',
          data,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Policy denied');
      expect(text).toContain('not in allowed list');
      expect(result.isError).toBe(true);
    });
  });

  // --- sign_permit ---

  describe('sign_permit', () => {
    it('should return real cryptographic signature for valid permit', async () => {
      const deadline = Math.floor(Date.now() / 1000) + 1800;

      const result = await client.callTool({
        name: 'sign_permit',
        arguments: {
          chainId: 1,
          token: USDC,
          spender: SPENDER,
          value: '500000000000000000',
          deadline,
          domain: {
            name: 'USD Coin',
            version: '2',
            chainId: 1,
            verifyingContract: USDC,
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
            owner: HARDHAT_0_ADDRESS,
            spender: SPENDER,
            value: '500000000000000000',
            nonce: '0',
            deadline: String(deadline),
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      const sig = JSON.parse(text);
      expect(sig.v).toBeTypeOf('number');
      expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/);
      expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.isError).toBeFalsy();
    });
  });
});

// ============================================================================
// Separate describe: unsafe tools enabled
// ============================================================================

describe('MCP server E2E (unsafeRawSign enabled)', () => {
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    const signer = new LocalEvmSigner();
    const policyEngine = new PolicyEngine(TEST_POLICY, [erc20Evaluator]);
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    const auditLogger = new AuditLogger(sink);

    server = createMcpServer({
      signer,
      policyEngine,
      auditLogger,
      unsafeRawSign: true,
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'e2e-test-unsafe', version: '1.0.0' });

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it('should list all 6 tools when unsafeRawSign is enabled', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain('get_address');
    expect(names).toContain('health_check');
    expect(names).toContain('sign_swap');
    expect(names).toContain('sign_permit');
    expect(names).toContain('sign_transaction');
    expect(names).toContain('sign_typed_data');
    expect(names).toHaveLength(6);
  });
});
