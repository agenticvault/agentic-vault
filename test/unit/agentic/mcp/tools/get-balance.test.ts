import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetBalance } from '@/agentic/mcp/tools/get-balance.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

type ToolHandlerResult = { content: { type: string; text: string }[]; isError?: boolean };

function createMockRpcProvider() {
  return {
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getErc20Balance: vi.fn().mockResolvedValue(500000000n),
    getTransactionCount: vi.fn().mockResolvedValue(0),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 30000000000n, maxPriorityFeePerGas: 1500000000n }),
    getNativeCurrencySymbol: vi.fn().mockReturnValue('ETH'),
    sendRawTransaction: vi.fn().mockResolvedValue('0x'),
  };
}

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditLogger: { log: vi.fn() },
    rpcProvider: createMockRpcProvider(),
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

describe('get_balance tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  let handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerGetBalance(server, ctx);
    handler = getToolHandler(server, 'get_balance');
  });

  it('should register the get_balance tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should return native balance', async () => {
    const result = await handler({ chainId: 1 });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.balance).toBe('1000000000000000000');
    expect(data.symbol).toBe('ETH');
  });

  it('should return ERC20 balance when token provided', async () => {
    const result = await handler({
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.balance).toBe('500000000');
    expect(data.symbol).toBe('ERC20');
  });

  it('should return error when rpcProvider is missing', async () => {
    ctx = createMockContext({ rpcProvider: undefined });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerGetBalance(server, ctx);
    handler = getToolHandler(server, 'get_balance');

    const result = await handler({ chainId: 1 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('RPC provider is required');
  });
});
