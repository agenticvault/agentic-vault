import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSendErc20Transfer } from '@/agentic/mcp/tools/send-erc20-transfer.js';
import { type ToolContext } from '@/agentic/mcp/tools/shared.js';

type ToolHandlerResult = { content: { type: string; text: string }[]; isError?: boolean };

function createMockRpcProvider() {
  return {
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getErc20Balance: vi.fn().mockResolvedValue(500000000n),
    getTransactionCount: vi.fn().mockResolvedValue(42),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 30000000000n, maxPriorityFeePerGas: 1500000000n }),
    getNativeCurrencySymbol: vi.fn().mockReturnValue('ETH'),
    sendRawTransaction: vi.fn().mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
  };
}

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    signer: {
      getAddress: vi.fn().mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
      signTransaction: vi.fn().mockResolvedValue('0x02f8...signedtx'),
      signTypedData: vi.fn(),
      healthCheck: vi.fn(),
    },
    policyEngine: {
      evaluate: vi.fn().mockReturnValue({ allowed: true, violations: [] }),
    },
    auditLogger: { log: vi.fn() },
    dispatcher: {
      dispatch: vi.fn().mockReturnValue({
        protocol: 'erc20',
        action: 'transfer',
        chainId: 1,
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        selector: '0xa9059cbb',
        args: { to: '0x1234567890123456789012345678901234567890', amount: 1000000n },
      }),
    },
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

describe('send_erc20_transfer tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  let handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSendErc20Transfer(server, ctx);
    handler = getToolHandler(server, 'send_erc20_transfer');
  });

  it('should register the send_erc20_transfer tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should return txHash on success', async () => {
    const result = await handler({
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.txHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
  });

  it('should return error when dispatcher is missing', async () => {
    ctx = createMockContext({ dispatcher: undefined });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerSendErc20Transfer(server, ctx);
    handler = getToolHandler(server, 'send_erc20_transfer');

    const result = await handler({
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Dispatcher is required');
  });

  it('should return error when rpcProvider is missing', async () => {
    ctx = createMockContext({ rpcProvider: undefined });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerSendErc20Transfer(server, ctx);
    handler = getToolHandler(server, 'send_erc20_transfer');

    const result = await handler({
      chainId: 1,
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('RPC provider is required');
  });
});
