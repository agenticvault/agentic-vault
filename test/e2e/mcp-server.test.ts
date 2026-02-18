import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { encodeFunctionData, type Address } from 'viem';
import { createMcpServer } from '@/agentic/mcp/server.js';
import { PolicyEngine, erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator } from '@/protocols/index.js';
import type { PolicyConfigV2 } from '@/protocols/index.js';
import type { ToolRpcProvider } from '@/agentic/mcp/tools/shared.js';
import { AuditLogger } from '@/agentic/audit/logger.js';
import { LocalEvmSigner, HARDHAT_0_ADDRESS } from '../helpers/local-signer.js';
import { Writable } from 'node:stream';

// ============================================================================
// Constants
// ============================================================================

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;
const SPENDER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;
const SWAP_ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;
const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address;

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

const uniswapV3Abi = [
  {
    name: 'exactInputSingle',
    type: 'function' as const,
    stateMutability: 'payable' as const,
    inputs: [
      {
        name: 'params',
        type: 'tuple' as const,
        components: [
          { name: 'tokenIn', type: 'address' as const },
          { name: 'tokenOut', type: 'address' as const },
          { name: 'fee', type: 'uint24' as const },
          { name: 'recipient', type: 'address' as const },
          { name: 'amountIn', type: 'uint256' as const },
          { name: 'amountOutMinimum', type: 'uint256' as const },
          { name: 'sqrtPriceLimitX96', type: 'uint160' as const },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' as const }],
  },
] as const;

const aaveV3Abi = [
  {
    name: 'supply' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'onBehalfOf', type: 'address' as const },
      { name: 'referralCode', type: 'uint16' as const },
    ],
    outputs: [],
  },
  {
    name: 'borrow' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'interestRateMode', type: 'uint256' as const },
      { name: 'referralCode', type: 'uint16' as const },
      { name: 'onBehalfOf', type: 'address' as const },
    ],
    outputs: [],
  },
  {
    name: 'repay' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'interestRateMode', type: 'uint256' as const },
      { name: 'onBehalfOf', type: 'address' as const },
    ],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
  {
    name: 'withdraw' as const,
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'asset', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
      { name: 'to', type: 'address' as const },
    ],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
] as const;

const TEST_POLICY: PolicyConfigV2 = {
  allowedChainIds: [1],
  allowedContracts: [
    USDC.toLowerCase() as `0x${string}`,
    SWAP_ROUTER.toLowerCase() as `0x${string}`,
    AAVE_V3_POOL.toLowerCase() as `0x${string}`,
    HARDHAT_0_ADDRESS.toLowerCase() as `0x${string}`, // for send_transfer recipient
  ],
  allowedSelectors: ['0x095ea7b3', '0x04e45aaf', '0x617ba037', '0xa415bcad', '0x573ade81', '0x69328dec', '0xa9059cbb'],
  maxAmountWei: 10n ** 18n,
  maxDeadlineSeconds: 3600,
  protocolPolicies: {
    erc20: {
      tokenAllowlist: [USDC.toLowerCase() as Address],
      recipientAllowlist: [
        SPENDER.toLowerCase() as Address,
        AAVE_V3_POOL.toLowerCase() as Address,
        HARDHAT_0_ADDRESS.toLowerCase() as Address, // for send_erc20_transfer recipient
      ],
      maxAllowanceWei: 10n ** 18n,
    },
    uniswap_v3: {
      tokenAllowlist: [
        WETH.toLowerCase() as Address,
        USDC.toLowerCase() as Address,
      ],
      recipientAllowlist: [HARDHAT_0_ADDRESS.toLowerCase() as Address],
      maxSlippageBps: 100,
    },
    aave_v3: {
      tokenAllowlist: [USDC.toLowerCase() as Address],
      recipientAllowlist: [HARDHAT_0_ADDRESS.toLowerCase() as Address],
      maxAmountWei: 10n ** 18n,
      maxInterestRateMode: 2,
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
    const policyEngine = new PolicyEngine(TEST_POLICY, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);
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
      expect(names).toContain('sign_defi_call');
      expect(names).toContain('get_balance');
      expect(names).toContain('send_transfer');
      expect(names).toContain('send_erc20_transfer');
      expect(names).not.toContain('sign_transaction');
      expect(names).not.toContain('sign_typed_data');
      expect(names).toHaveLength(8);
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

  // --- sign_defi_call ---

  describe('sign_defi_call', () => {
    it('should return signed transaction for known protocol calldata', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 500000000000000000n],
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: USDC,
          data,
          value: '500000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toMatch(/^0x02f8/);
      expect(result.isError).toBeFalsy();
    });

    it('should reject unknown protocol calldata (fail-closed)', async () => {
      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: USDC,
          data: '0xdeadbeef0000000000000000000000000000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Rejected');
      expect(result.isError).toBe(true);
    });
  });

  // --- Uniswap V3 via sign_defi_call ---

  describe('sign_defi_call (Uniswap V3)', () => {
    it('should return signed transaction for exactInputSingle', async () => {
      const data = encodeFunctionData({
        abi: uniswapV3Abi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 3000,
            recipient: HARDHAT_0_ADDRESS,
            amountIn: 500000000000000000n,
            amountOutMinimum: 900000000n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: SWAP_ROUTER,
          data,
          value: '500000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      // EIP-1559: 0x02 + RLP prefix (f8 for short, f9 for longer payloads)
      expect(text).toMatch(/^0x02f[89]/);
      expect(result.isError).toBeFalsy();
    });

    it('should deny Uniswap V3 swap with zero slippage protection', async () => {
      const data = encodeFunctionData({
        abi: uniswapV3Abi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 3000,
            recipient: HARDHAT_0_ADDRESS,
            amountIn: 500000000000000000n,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: SWAP_ROUTER,
          data,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Policy denied');
      expect(text).toContain('amountOutMinimum');
      expect(result.isError).toBe(true);
    });
  });

  // --- sign_defi_call (Aave V3) ---

  describe('sign_defi_call (Aave V3)', () => {
    it('should return signed transaction for Aave V3 supply', async () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [USDC, 500000000n, HARDHAT_0_ADDRESS, 0],
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: AAVE_V3_POOL,
          data,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toMatch(/^0x02f[89]/);
      expect(result.isError).toBeFalsy();
    });

    it('should deny Aave V3 borrow with interestRateMode exceeding policy', async () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'borrow',
        args: [USDC, 100000000n, 3n, 0, HARDHAT_0_ADDRESS], // mode 3 > max 2
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: AAVE_V3_POOL,
          data,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Policy denied');
      expect(text).toContain('interestRateMode');
      expect(result.isError).toBe(true);
    });

    it('should reject unknown selector sent to Aave Pool (fail-closed)', async () => {
      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: AAVE_V3_POOL,
          data: '0xdeadbeef0000000000000000000000000000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Rejected');
      expect(result.isError).toBe(true);
    });

    it('should support cross-protocol flow: approve then supply', async () => {
      // Step 1: ERC-20 approve (grant allowance to Aave Pool)
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [AAVE_V3_POOL, 500000000n],
      });

      const approveResult = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: USDC,
          data: approveData,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const approveText = (approveResult.content as any[])[0].text;
      expect(approveText).toMatch(/^0x02f[89]/);
      expect(approveResult.isError).toBeFalsy();

      // Step 2: Aave supply
      const supplyData = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'supply',
        args: [USDC, 500000000n, HARDHAT_0_ADDRESS, 0],
      });

      const supplyResult = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: AAVE_V3_POOL,
          data: supplyData,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supplyText = (supplyResult.content as any[])[0].text;
      expect(supplyText).toMatch(/^0x02f[89]/);
      expect(supplyResult.isError).toBeFalsy();
    });

    it('should return signed transaction for Aave V3 repay', async () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'repay',
        args: [USDC, 500000000n, 1n, HARDHAT_0_ADDRESS],
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: AAVE_V3_POOL,
          data,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toMatch(/^0x02f[89]/);
      expect(result.isError).toBeFalsy();
    });

    it('should return signed transaction for Aave V3 withdraw', async () => {
      const data = encodeFunctionData({
        abi: aaveV3Abi,
        functionName: 'withdraw',
        args: [USDC, 500000000n, HARDHAT_0_ADDRESS],
      });

      const result = await client.callTool({
        name: 'sign_defi_call',
        arguments: {
          chainId: 1,
          to: AAVE_V3_POOL,
          data,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toMatch(/^0x02f[89]/);
      expect(result.isError).toBeFalsy();
    });
  });

  // --- sign_swap unknown protocol rejection ---

  describe('sign_swap (fail-closed)', () => {
    it('should reject unknown selector before policy evaluation', async () => {
      const result = await client.callTool({
        name: 'sign_swap',
        arguments: {
          chainId: 1,
          to: USDC,
          data: '0xdeadbeef0000000000000000000000000000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Rejected');
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

  // --- Transfer/Balance tools without rpcProvider ---

  describe('transfer/balance tools (no rpcProvider)', () => {
    it('should return error for get_balance without rpcProvider', async () => {
      const result = await client.callTool({
        name: 'get_balance',
        arguments: { chainId: 1 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('RPC provider is required');
      expect(result.isError).toBe(true);
    });

    it('should return error for send_transfer without rpcProvider', async () => {
      const result = await client.callTool({
        name: 'send_transfer',
        arguments: {
          chainId: 1,
          to: HARDHAT_0_ADDRESS,
          value: '1000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('RPC provider is required');
      expect(result.isError).toBe(true);
    });

    it('should return error for send_erc20_transfer without rpcProvider', async () => {
      const result = await client.callTool({
        name: 'send_erc20_transfer',
        arguments: {
          chainId: 1,
          token: USDC,
          to: HARDHAT_0_ADDRESS,
          amount: '1000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('RPC provider is required');
      expect(result.isError).toBe(true);
    });
  });
});

// ============================================================================
// Separate describe: transfer/balance tools with rpcProvider
// ============================================================================

function createMockRpcProvider(): ToolRpcProvider {
  return {
    getBalance: vi.fn().mockResolvedValue(1_000_000_000_000_000_000n),
    getErc20Balance: vi.fn().mockResolvedValue(500_000_000n),
    getTransactionCount: vi.fn().mockResolvedValue(42),
    estimateGas: vi.fn().mockResolvedValue(21_000n),
    getGasPrice: vi.fn().mockResolvedValue(20_000_000_000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1_500_000_000n }),
    getNativeCurrencySymbol: vi.fn().mockReturnValue('ETH'),
    sendRawTransaction: vi.fn().mockResolvedValue(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`,
    ),
  };
}

describe('MCP server E2E (with rpcProvider)', () => {
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    const signer = new LocalEvmSigner();
    const policyEngine = new PolicyEngine(TEST_POLICY, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    const auditLogger = new AuditLogger(sink);
    const rpcProvider = createMockRpcProvider();

    server = createMcpServer({ signer, policyEngine, auditLogger, rpcProvider });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'e2e-test-rpc', version: '1.0.0' });

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  describe('get_balance', () => {
    it('should return native balance via MCP round-trip', async () => {
      const result = await client.callTool({
        name: 'get_balance',
        arguments: { chainId: 1 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      const data = JSON.parse(text);
      expect(data.balance).toBe('1000000000000000000');
      expect(data.symbol).toBe('ETH');
      expect(result.isError).toBeFalsy();
    });

    it('should return ERC20 balance with token parameter', async () => {
      const result = await client.callTool({
        name: 'get_balance',
        arguments: { chainId: 1, token: USDC },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      const data = JSON.parse(text);
      expect(data.balance).toBe('500000000');
      expect(data.symbol).toBe('ERC20');
      expect(result.isError).toBeFalsy();
    });
  });

  describe('send_transfer', () => {
    it('should succeed and return txHash JSON', async () => {
      const result = await client.callTool({
        name: 'send_transfer',
        arguments: {
          chainId: 1,
          to: HARDHAT_0_ADDRESS,
          value: '500000000000000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      const data = JSON.parse(text);
      expect(data.txHash).toMatch(/^0x[0-9a-f]+$/);
      expect(data.explorerUrl).toContain('etherscan.io');
      expect(result.isError).toBeFalsy();
    });

    it('should return policy denied error for disallowed chain', async () => {
      const result = await client.callTool({
        name: 'send_transfer',
        arguments: {
          chainId: 999,
          to: HARDHAT_0_ADDRESS,
          value: '1000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Policy denied');
      expect(result.isError).toBe(true);
    });
  });

  describe('send_erc20_transfer', () => {
    it('should succeed and return txHash JSON', async () => {
      const result = await client.callTool({
        name: 'send_erc20_transfer',
        arguments: {
          chainId: 1,
          token: USDC,
          to: HARDHAT_0_ADDRESS,
          amount: '500000000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      const data = JSON.parse(text);
      expect(data.txHash).toMatch(/^0x[0-9a-f]+$/);
      expect(result.isError).toBeFalsy();
    });

    it('should return policy denied for unauthorized token', async () => {
      const result = await client.callTool({
        name: 'send_erc20_transfer',
        arguments: {
          chainId: 1,
          token: '0x0000000000000000000000000000000000000bad',
          to: HARDHAT_0_ADDRESS,
          amount: '1000',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (result.content as any[])[0].text;
      expect(text).toContain('Policy denied');
      expect(result.isError).toBe(true);
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
    const policyEngine = new PolicyEngine(TEST_POLICY, [erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator]);
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

  it('should list all 10 tools when unsafeRawSign is enabled', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain('get_address');
    expect(names).toContain('health_check');
    expect(names).toContain('sign_swap');
    expect(names).toContain('sign_permit');
    expect(names).toContain('sign_defi_call');
    expect(names).toContain('get_balance');
    expect(names).toContain('send_transfer');
    expect(names).toContain('send_erc20_transfer');
    expect(names).toContain('sign_transaction');
    expect(names).toContain('sign_typed_data');
    expect(names).toHaveLength(10);
  });
});
