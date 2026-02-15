import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { encodeFunctionData, type Address } from 'viem';
import { registerSignSwap } from '@/agentic/mcp/tools/sign-swap.js';
import { registerSignPermit } from '@/agentic/mcp/tools/sign-permit.js';
import { registerSignDefiCall } from '@/agentic/mcp/tools/sign-defi-call.js';
import type { ToolContext, ToolSigner } from '@/agentic/mcp/tools/shared.js';
import { PolicyEngine, erc20Evaluator, uniswapV3Evaluator, aaveV3Evaluator, ProtocolDispatcher, createDefaultRegistry } from '@/protocols/index.js';
import type { PolicyConfigV2 } from '@/protocols/index.js';
import { AuditLogger } from '@/agentic/audit/logger.js';
import { Writable } from 'node:stream';

// ============================================================================
// Constants
// ============================================================================

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;
const SPENDER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;
const SWAP_ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as Address;
const RECIPIENT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
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

// ============================================================================
// Helpers
// ============================================================================

function createPolicyConfig(overrides?: Partial<PolicyConfigV2>): PolicyConfigV2 {
  return {
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
    ...overrides,
  };
}

function createMockSigner(): ToolSigner {
  return {
    getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
    signTransaction: vi.fn().mockResolvedValue('0x02f8signed'),
    signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
    healthCheck: vi.fn().mockResolvedValue(undefined),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolHandler(server: McpServer, toolName: string): (args: Record<string, unknown>) => Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { handler: (args: Record<string, unknown>) => Promise<any> }
  >;
  return tools[toolName].handler;
}

// ============================================================================
// Tests: MCP tool handlers with real PolicyEngine (mock signer only)
// ============================================================================

describe('MCP tool → PolicyEngine integration', () => {
  let server: McpServer;
  let signer: ToolSigner;
  let auditSink: string[];
  let auditLogger: AuditLogger;
  let ctx: ToolContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    signer = createMockSigner();

    // Capture audit output
    auditSink = [];
    const sink = new Writable({
      write(chunk, _encoding, cb) {
        auditSink.push(chunk.toString());
        cb();
      },
    });
    auditLogger = new AuditLogger(sink);

    const policyEngine = new PolicyEngine(createPolicyConfig(), [erc20Evaluator]);
    const dispatcher = new ProtocolDispatcher(createDefaultRegistry());

    ctx = { signer, policyEngine, auditLogger, dispatcher };
    server = new McpServer({ name: 'test-integration', version: '0.0.1' });
    registerSignSwap(server, ctx);
    registerSignPermit(server, ctx);
    registerSignDefiCall(server, ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- sign_swap ---

  describe('sign_swap with real PolicyEngine', () => {
    it('should approve and sign when calldata matches policy', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 500000000000000000n],
      });

      const handler = getToolHandler(server, 'sign_swap');
      const result = await handler({
        chainId: 1,
        to: USDC,
        data,
        value: '500000000000000000',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('0x02f8signed');
      expect(signer.signTransaction).toHaveBeenCalled();
    });

    it('should deny when contract not in allowedContracts', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const handler = getToolHandler(server, 'sign_swap');
      const result = await handler({
        chainId: 1,
        to: '0x0000000000000000000000000000000000000bad',
        data,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(result.content[0].text).toContain('not in allowed list');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should deny when chainId not in allowedChainIds', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const handler = getToolHandler(server, 'sign_swap');
      const result = await handler({
        chainId: 42161, // Arbitrum — not in [1]
        to: USDC,
        data,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(result.content[0].text).toContain('chainId');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should reject unknown selector before policy evaluation (fail-closed)', async () => {
      const handler = getToolHandler(server, 'sign_swap');
      const result = await handler({
        chainId: 1,
        to: USDC,
        data: '0xdeadbeef0000000000000000000000000000000000000000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rejected');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });
  });

  // --- sign_defi_call ---

  describe('sign_defi_call with real Dispatcher + PolicyEngine', () => {
    it('should approve and sign when calldata matches known protocol', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 500000000000000000n],
      });

      const handler = getToolHandler(server, 'sign_defi_call');
      const result = await handler({
        chainId: 1,
        to: USDC,
        data,
        value: '500000000000000000',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('0x02f8signed');
      expect(signer.signTransaction).toHaveBeenCalled();
    });

    it('should reject unknown calldata with fail-closed semantics', async () => {
      const handler = getToolHandler(server, 'sign_defi_call');
      const result = await handler({
        chainId: 1,
        to: USDC,
        data: '0xdeadbeef0000000000000000000000000000000000000000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rejected');
      expect(result.content[0].text).toContain('No registered decoder');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should deny when policy rejects known protocol calldata', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const handler = getToolHandler(server, 'sign_defi_call');
      const result = await handler({
        chainId: 1,
        to: '0x0000000000000000000000000000000000000bad',
        data,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });
  });

  // --- sign_permit ---

  describe('sign_permit with real PolicyEngine', () => {
    const validPermitArgs = {
      chainId: 1,
      token: USDC,
      spender: SPENDER,
      value: '500000000000000000',
      deadline: Math.floor(new Date('2026-01-15T12:00:00Z').getTime() / 1000) + 1800,
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
        owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        spender: SPENDER,
        value: '500000000000000000',
        nonce: '0',
        deadline: String(Math.floor(new Date('2026-01-15T12:00:00Z').getTime() / 1000) + 1800),
      },
    };

    it('should approve and sign a valid permit', async () => {
      const handler = getToolHandler(server, 'sign_permit');
      const result = await handler(validPermitArgs);

      expect(result.isError).toBeUndefined();
      const sig = JSON.parse(result.content[0].text);
      expect(sig).toEqual({ v: 27, r: '0xabc', s: '0xdef' });
      expect(signer.signTypedData).toHaveBeenCalled();
    });

    it('should deny permit when domain.verifyingContract does not match token', async () => {
      const handler = getToolHandler(server, 'sign_permit');
      const result = await handler({
        ...validPermitArgs,
        domain: {
          ...validPermitArgs.domain,
          verifyingContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Payload mismatch');
      expect(signer.signTypedData).not.toHaveBeenCalled();
    });

    it('should deny permit when domain.chainId does not match args.chainId', async () => {
      const handler = getToolHandler(server, 'sign_permit');
      const result = await handler({
        ...validPermitArgs,
        domain: {
          ...validPermitArgs.domain,
          chainId: 137, // Polygon != 1
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Payload mismatch');
      expect(signer.signTypedData).not.toHaveBeenCalled();
    });
  });

  // --- Audit logging ---

  describe('audit logging', () => {
    it('should log approved entry with correct fields', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const handler = getToolHandler(server, 'sign_swap');
      await handler({ chainId: 1, to: USDC, data });

      expect(auditSink).toHaveLength(1);
      const entry = JSON.parse(auditSink[0]);
      expect(entry.service).toBe('agentic-vault-mcp');
      expect(entry.action).toBe('sign_swap');
      expect(entry.result).toBe('approved');
      expect(entry.traceId).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    it('should log denied entry with violations', async () => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [SPENDER, 100n],
      });

      const handler = getToolHandler(server, 'sign_swap');
      await handler({
        chainId: 999,
        to: '0x0000000000000000000000000000000000000bad',
        data,
      });

      expect(auditSink).toHaveLength(1);
      const entry = JSON.parse(auditSink[0]);
      expect(entry.result).toBe('denied');
      expect(entry.details.violations).toBeDefined();
      expect(entry.details.violations.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Tests: Uniswap V3 through MCP tool pipeline
// ============================================================================

describe('MCP tool → Uniswap V3 integration', () => {
  let server: McpServer;
  let signer: ToolSigner;
  let ctx: ToolContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    signer = createMockSigner();
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    const auditLogger = new AuditLogger(sink);

    const policyEngine = new PolicyEngine(
      createPolicyConfig({
        allowedContracts: [
          USDC.toLowerCase() as `0x${string}`,
          SWAP_ROUTER.toLowerCase() as `0x${string}`,
        ],
        allowedSelectors: ['0x095ea7b3', '0x04e45aaf'],
        protocolPolicies: {
          erc20: {
            tokenAllowlist: [USDC.toLowerCase() as Address],
            recipientAllowlist: [SPENDER.toLowerCase() as Address],
            maxAllowanceWei: 10n ** 18n,
          },
          uniswap_v3: {
            tokenAllowlist: [
              WETH.toLowerCase() as Address,
              USDC.toLowerCase() as Address,
            ],
            recipientAllowlist: [RECIPIENT.toLowerCase() as Address],
            maxSlippageBps: 100,
          },
        },
      }),
      [erc20Evaluator, uniswapV3Evaluator],
    );
    const dispatcher = new ProtocolDispatcher(createDefaultRegistry());

    ctx = { signer, policyEngine, auditLogger, dispatcher };
    server = new McpServer({ name: 'test-uni-integration', version: '0.0.1' });
    registerSignSwap(server, ctx);
    registerSignDefiCall(server, ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should approve and sign Uniswap V3 exactInputSingle via sign_defi_call', async () => {
    const data = encodeFunctionData({
      abi: uniswapV3Abi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: WETH,
          tokenOut: USDC,
          fee: 3000,
          recipient: RECIPIENT,
          amountIn: 1000000000000000000n,
          amountOutMinimum: 1800000000n,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: SWAP_ROUTER,
      data,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('0x02f8signed');
    expect(signer.signTransaction).toHaveBeenCalled();
  });

  it('should deny Uniswap V3 swap with unauthorized token', async () => {
    const UNKNOWN_TOKEN = '0x0000000000000000000000000000000000000bad' as Address;
    const data = encodeFunctionData({
      abi: uniswapV3Abi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: UNKNOWN_TOKEN,
          tokenOut: USDC,
          fee: 3000,
          recipient: RECIPIENT,
          amountIn: 1000n,
          amountOutMinimum: 1n,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: SWAP_ROUTER,
      data,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Policy denied');
    expect(result.content[0].text).toContain('tokenIn');
    expect(signer.signTransaction).not.toHaveBeenCalled();
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
          recipient: RECIPIENT,
          amountIn: 1000000000000000000n,
          amountOutMinimum: 0n, // No slippage protection
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: SWAP_ROUTER,
      data,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Policy denied');
    expect(result.content[0].text).toContain('amountOutMinimum');
    expect(signer.signTransaction).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: Aave V3 through MCP tool pipeline
// ============================================================================

describe('MCP tool → Aave V3 integration', () => {
  let server: McpServer;
  let signer: ToolSigner;
  let ctx: ToolContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    signer = createMockSigner();
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    const auditLogger = new AuditLogger(sink);

    const policyEngine = new PolicyEngine(
      createPolicyConfig({
        allowedContracts: [
          USDC.toLowerCase() as `0x${string}`,
          AAVE_V3_POOL.toLowerCase() as `0x${string}`,
        ],
        allowedSelectors: ['0x095ea7b3', '0x617ba037', '0x573ade81', '0x69328dec'],
        protocolPolicies: {
          erc20: {
            tokenAllowlist: [USDC.toLowerCase() as Address],
            recipientAllowlist: [AAVE_V3_POOL.toLowerCase() as Address],
            maxAllowanceWei: 10n ** 18n,
          },
          aave_v3: {
            tokenAllowlist: [USDC.toLowerCase() as Address],
            recipientAllowlist: [RECIPIENT.toLowerCase() as Address],
            maxAmountWei: 10n ** 18n,
            maxInterestRateMode: 2,
          },
        },
      }),
      [erc20Evaluator, aaveV3Evaluator],
    );
    const dispatcher = new ProtocolDispatcher(createDefaultRegistry());

    ctx = { signer, policyEngine, auditLogger, dispatcher };
    server = new McpServer({ name: 'test-aave-integration', version: '0.0.1' });
    registerSignDefiCall(server, ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should approve and sign Aave V3 supply via sign_defi_call', async () => {
    const data = encodeFunctionData({
      abi: aaveV3Abi,
      functionName: 'supply',
      args: [USDC, 500000000n, RECIPIENT, 0],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: AAVE_V3_POOL,
      data,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('0x02f8signed');
    expect(signer.signTransaction).toHaveBeenCalled();
  });

  it('should deny Aave V3 supply with unauthorized asset', async () => {
    const UNKNOWN_TOKEN = '0x0000000000000000000000000000000000000bad' as Address;
    const data = encodeFunctionData({
      abi: aaveV3Abi,
      functionName: 'supply',
      args: [UNKNOWN_TOKEN, 100n, RECIPIENT, 0],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: AAVE_V3_POOL,
      data,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Policy denied');
    expect(result.content[0].text).toContain('tokenAllowlist');
    expect(signer.signTransaction).not.toHaveBeenCalled();
  });

  it('should deny Aave V3 supply that exceeds maxAmountWei', async () => {
    const data = encodeFunctionData({
      abi: aaveV3Abi,
      functionName: 'supply',
      args: [USDC, 2n * 10n ** 18n, RECIPIENT, 0], // exceeds maxAmountWei
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: AAVE_V3_POOL,
      data,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Policy denied');
    expect(result.content[0].text).toContain('maxAmountWei');
    expect(signer.signTransaction).not.toHaveBeenCalled();
  });

  it('should support cross-protocol flow: ERC-20 approve then Aave supply', async () => {
    // Step 1: ERC-20 approve (grant allowance to Aave Pool)
    const approveData = encodeFunctionData({
      abi: [{
        name: 'approve' as const,
        type: 'function' as const,
        stateMutability: 'nonpayable' as const,
        inputs: [
          { name: 'spender', type: 'address' as const },
          { name: 'amount', type: 'uint256' as const },
        ],
        outputs: [{ name: '', type: 'bool' as const }],
      }],
      functionName: 'approve',
      args: [AAVE_V3_POOL, 500000000n],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const approveResult = await handler({
      chainId: 1,
      to: USDC,
      data: approveData,
    });
    expect(approveResult.isError).toBeUndefined();
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);

    // Step 2: Aave supply
    const supplyData = encodeFunctionData({
      abi: aaveV3Abi,
      functionName: 'supply',
      args: [USDC, 500000000n, RECIPIENT, 0],
    });

    const supplyResult = await handler({
      chainId: 1,
      to: AAVE_V3_POOL,
      data: supplyData,
    });
    expect(supplyResult.isError).toBeUndefined();
    expect(signer.signTransaction).toHaveBeenCalledTimes(2);
  });

  it('should approve and sign Aave V3 repay via sign_defi_call', async () => {
    const data = encodeFunctionData({
      abi: aaveV3Abi,
      functionName: 'repay',
      args: [USDC, 500000000n, 1n, RECIPIENT],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: AAVE_V3_POOL,
      data,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('0x02f8signed');
    expect(signer.signTransaction).toHaveBeenCalled();
  });

  it('should approve and sign Aave V3 withdraw via sign_defi_call', async () => {
    const data = encodeFunctionData({
      abi: aaveV3Abi,
      functionName: 'withdraw',
      args: [USDC, 500000000n, RECIPIENT],
    });

    const handler = getToolHandler(server, 'sign_defi_call');
    const result = await handler({
      chainId: 1,
      to: AAVE_V3_POOL,
      data,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('0x02f8signed');
    expect(signer.signTransaction).toHaveBeenCalled();
  });
});
