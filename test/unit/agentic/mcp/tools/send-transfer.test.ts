import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSendTransfer } from '@/agentic/mcp/tools/send-transfer.js';
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

describe('send_transfer tool', () => {
  let server: McpServer;
  let ctx: ToolContext;
  let handler: (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' });
    ctx = createMockContext();
    registerSendTransfer(server, ctx);
    handler = getToolHandler(server, 'send_transfer');
  });

  it('should register the send_transfer tool', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should return txHash on success', async () => {
    const result = await handler({
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000000000000000000',
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.txHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
  });

  it('should return error when policy denies', async () => {
    ctx = createMockContext({
      policyEngine: {
        evaluate: vi.fn().mockReturnValue({
          allowed: false,
          violations: ['chain not allowed'],
        }),
      },
    });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerSendTransfer(server, ctx);
    handler = getToolHandler(server, 'send_transfer');

    const result = await handler({
      chainId: 999,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Policy denied');
  });

  it('should return error when rpcProvider is missing', async () => {
    ctx = createMockContext({ rpcProvider: undefined });
    server = new McpServer({ name: 'test', version: '0.0.1' });
    registerSendTransfer(server, ctx);
    handler = getToolHandler(server, 'send_transfer');

    const result = await handler({
      chainId: 1,
      to: '0x1234567890123456789012345678901234567890',
      value: '1000',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('RPC provider is required');
  });
});
