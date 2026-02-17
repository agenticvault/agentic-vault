import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Address } from 'viem';
import { registerGetBalance } from '@/agentic/mcp/tools/get-balance.js';
import { registerSendTransfer } from '@/agentic/mcp/tools/send-transfer.js';
import { registerSendErc20Transfer } from '@/agentic/mcp/tools/send-erc20-transfer.js';
import type { ToolContext, ToolSigner, ToolRpcProvider } from '@/agentic/mcp/tools/shared.js';
import { PolicyEngine, erc20Evaluator, ProtocolDispatcher, createDefaultRegistry } from '@/protocols/index.js';
import type { PolicyConfigV2 } from '@/protocols/index.js';
import { AuditLogger } from '@/agentic/audit/logger.js';
import { Writable } from 'node:stream';

// ============================================================================
// Constants
// ============================================================================

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address;
const RECIPIENT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
const SIGNER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`;
const TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

// ============================================================================
// Helpers
// ============================================================================

function createMockSigner(): ToolSigner {
  return {
    getAddress: vi.fn().mockResolvedValue(SIGNER_ADDRESS),
    signTransaction: vi.fn().mockResolvedValue('0x02f8signed'),
    signTypedData: vi.fn().mockResolvedValue({ v: 27, r: '0xabc', s: '0xdef' }),
    healthCheck: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockRpcProvider(): ToolRpcProvider {
  return {
    getBalance: vi.fn().mockResolvedValue(1_000_000_000_000_000_000n),
    getErc20Balance: vi.fn().mockResolvedValue(500_000_000n),
    getTransactionCount: vi.fn().mockResolvedValue(42),
    estimateGas: vi.fn().mockResolvedValue(21_000n),
    getGasPrice: vi.fn().mockResolvedValue(20_000_000_000n),
    sendRawTransaction: vi.fn().mockResolvedValue(TX_HASH),
  };
}

function createTransferPolicyConfig(overrides?: Partial<PolicyConfigV2>): PolicyConfigV2 {
  return {
    allowedChainIds: [1, 11155111],
    allowedContracts: [
      USDC.toLowerCase() as `0x${string}`,
      RECIPIENT.toLowerCase() as `0x${string}`, // for native send_transfer recipient
    ],
    allowedSelectors: ['0xa9059cbb'], // transfer selector
    maxAmountWei: 10n ** 18n,
    maxDeadlineSeconds: 3600,
    protocolPolicies: {
      erc20: {
        tokenAllowlist: [USDC.toLowerCase() as Address],
        recipientAllowlist: [RECIPIENT.toLowerCase() as Address],
        maxAllowanceWei: 10n ** 18n,
      },
    },
    ...overrides,
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
// Tests: get_balance with real PolicyEngine
// ============================================================================

describe('MCP tool → Transfer/Balance integration', () => {
  let server: McpServer;
  let signer: ToolSigner;
  let rpcProvider: ToolRpcProvider;
  let auditSink: string[];
  let auditLogger: AuditLogger;
  let ctx: ToolContext;

  beforeEach(() => {
    signer = createMockSigner();
    rpcProvider = createMockRpcProvider();

    auditSink = [];
    const sink = new Writable({
      write(chunk, _encoding, cb) {
        auditSink.push(chunk.toString());
        cb();
      },
    });
    auditLogger = new AuditLogger(sink);

    const policyEngine = new PolicyEngine(createTransferPolicyConfig(), [erc20Evaluator]);
    const dispatcher = new ProtocolDispatcher(createDefaultRegistry());

    ctx = { signer, policyEngine, auditLogger, dispatcher, rpcProvider };
    server = new McpServer({ name: 'test-transfer-integration', version: '0.0.1' });
    registerGetBalance(server, ctx);
    registerSendTransfer(server, ctx);
    registerSendErc20Transfer(server, ctx);
  });

  // --- get_balance ---

  describe('get_balance with real RPC/signer/audit pipeline', () => {
    it('should return native balance with symbol ETH', async () => {
      const handler = getToolHandler(server, 'get_balance');
      const result = await handler({ chainId: 1 });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.balance).toBe('1000000000000000000');
      expect(data.symbol).toBe('ETH');
    });

    it('should return ERC20 balance with symbol ERC20', async () => {
      const handler = getToolHandler(server, 'get_balance');
      const result = await handler({ chainId: 1, token: USDC });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.balance).toBe('500000000');
      expect(data.symbol).toBe('ERC20');
    });

    it('should use explicit address instead of signer', async () => {
      const handler = getToolHandler(server, 'get_balance');
      const explicitAddr = '0x1234567890123456789012345678901234567890';
      await handler({ chainId: 1, address: explicitAddr });

      expect(signer.getAddress).not.toHaveBeenCalled();
      expect(rpcProvider.getBalance).toHaveBeenCalledWith(1, explicitAddr);
    });

    it('should fall back to signer address when no address provided', async () => {
      const handler = getToolHandler(server, 'get_balance');
      await handler({ chainId: 1 });

      expect(signer.getAddress).toHaveBeenCalled();
      expect(rpcProvider.getBalance).toHaveBeenCalledWith(1, SIGNER_ADDRESS);
    });

    it('should write audit log entry with correct fields', async () => {
      const handler = getToolHandler(server, 'get_balance');
      await handler({ chainId: 1 });

      expect(auditSink).toHaveLength(1);
      const entry = JSON.parse(auditSink[0]);
      expect(entry.service).toBe('agentic-vault-mcp');
      expect(entry.action).toBe('get_balance');
      expect(entry.result).toBe('approved');
      expect(entry.traceId).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });
  });

  // --- send_transfer ---

  describe('send_transfer with real PolicyEngine', () => {
    it('should approve, sign, and broadcast when policy allows', async () => {
      const handler = getToolHandler(server, 'send_transfer');
      const result = await handler({
        chainId: 1,
        to: RECIPIENT,
        value: '500000000000000000',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.txHash).toBe(TX_HASH);
      expect(data.explorerUrl).toContain('etherscan.io');
      expect(signer.signTransaction).toHaveBeenCalled();
      expect(rpcProvider.sendRawTransaction).toHaveBeenCalled();
    });

    it('should deny when chainId is not in allowedChainIds', async () => {
      const handler = getToolHandler(server, 'send_transfer');
      const result = await handler({
        chainId: 999,
        to: RECIPIENT,
        value: '1000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(result.content[0].text).toContain('chainId');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should deny when amount exceeds maxAmountWei', async () => {
      const handler = getToolHandler(server, 'send_transfer');
      const result = await handler({
        chainId: 1,
        to: RECIPIENT,
        value: '2000000000000000000', // 2 ETH > 1 ETH max
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should audit log approved transfer with correct fields', async () => {
      const handler = getToolHandler(server, 'send_transfer');
      await handler({
        chainId: 1,
        to: RECIPIENT,
        value: '1000',
      });

      expect(auditSink).toHaveLength(1);
      const entry = JSON.parse(auditSink[0]);
      expect(entry.action).toBe('send_transfer');
      expect(entry.result).toBe('approved');
      expect(entry.details.txHash).toBe(TX_HASH);
    });

    it('should audit log denied transfer with violations', async () => {
      const handler = getToolHandler(server, 'send_transfer');
      await handler({
        chainId: 999,
        to: RECIPIENT,
        value: '1000',
      });

      expect(auditSink).toHaveLength(1);
      const entry = JSON.parse(auditSink[0]);
      expect(entry.result).toBe('denied');
      expect(entry.details.violations).toBeDefined();
      expect(entry.details.violations.length).toBeGreaterThan(0);
    });
  });

  // --- send_erc20_transfer ---

  describe('send_erc20_transfer with real Dispatcher + PolicyEngine', () => {
    it('should approve, sign, and broadcast ERC20 transfer', async () => {
      const handler = getToolHandler(server, 'send_erc20_transfer');
      const result = await handler({
        chainId: 1,
        token: USDC,
        to: RECIPIENT,
        amount: '500000000',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.txHash).toBe(TX_HASH);
      expect(data.explorerUrl).toContain('etherscan.io');
      expect(signer.signTransaction).toHaveBeenCalled();
    });

    it('should deny when recipient not in erc20 recipientAllowlist', async () => {
      const handler = getToolHandler(server, 'send_erc20_transfer');
      const result = await handler({
        chainId: 1,
        token: USDC,
        to: '0x0000000000000000000000000000000000000bad',
        amount: '1000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should deny when token not in erc20 tokenAllowlist', async () => {
      const handler = getToolHandler(server, 'send_erc20_transfer');
      const unknownToken = '0x0000000000000000000000000000000000000bad';
      const result = await handler({
        chainId: 1,
        token: unknownToken,
        to: RECIPIENT,
        amount: '1000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Policy denied');
      expect(signer.signTransaction).not.toHaveBeenCalled();
    });

    it('should audit log approved ERC20 transfer', async () => {
      const handler = getToolHandler(server, 'send_erc20_transfer');
      await handler({
        chainId: 1,
        token: USDC,
        to: RECIPIENT,
        amount: '500000000',
      });

      expect(auditSink).toHaveLength(1);
      const entry = JSON.parse(auditSink[0]);
      expect(entry.action).toBe('send_erc20_transfer');
      expect(entry.result).toBe('approved');
      expect(entry.details.txHash).toBe(TX_HASH);
    });

    it('should support cross-tool flow: get_balance then send_erc20_transfer', async () => {
      // Step 1: Query balance
      const balanceHandler = getToolHandler(server, 'get_balance');
      const balanceResult = await balanceHandler({ chainId: 1, token: USDC });

      expect(balanceResult.isError).toBeUndefined();
      const balanceData = JSON.parse(balanceResult.content[0].text);
      expect(balanceData.balance).toBe('500000000');

      // Step 2: Transfer
      const transferHandler = getToolHandler(server, 'send_erc20_transfer');
      const transferResult = await transferHandler({
        chainId: 1,
        token: USDC,
        to: RECIPIENT,
        amount: balanceData.balance,
      });

      expect(transferResult.isError).toBeUndefined();
      const transferData = JSON.parse(transferResult.content[0].text);
      expect(transferData.txHash).toBe(TX_HASH);

      // Both operations audited
      expect(auditSink).toHaveLength(2);
    });
  });
});
