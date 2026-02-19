import {
  signDefiCall,
  signPermit,
  getAddressWorkflow,
  healthCheckWorkflow,
  getBalanceWorkflow,
  sendTransfer,
  sendErc20Transfer,
  type WorkflowContext,
  type WorkflowResult,
} from '@agenticvault/agentic-vault/protocols';
import {
  type OpenClawPluginApi,
  type AnyAgentTool,
  type OpenClawPluginConfig,
} from './types.js';

// ─── Result Adapter ───

type ToolResult = { content: { type: 'text'; text: string }[]; details: undefined };

function toResult(result: WorkflowResult): ToolResult {
  switch (result.status) {
    case 'approved':
      return { content: [{ type: 'text', text: result.data }], details: undefined };
    case 'dry-run-approved': {
      const replacer = (_k: string, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v;
      return {
        content: [
          { type: 'text', text: JSON.stringify(result.details, replacer) },
        ],
        details: undefined,
      };
    }
    case 'denied':
      return { content: [{ type: 'text', text: result.reason }], details: undefined };
    case 'error':
      return { content: [{ type: 'text', text: `Error: ${result.reason}` }], details: undefined };
  }
}

// ─── Safe Tools (always registered) ───

function registerGetAddress(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_get_address',
    label: 'Get Vault Address',
    description: 'Get the wallet address managed by this vault',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_toolCallId: string, _params: Record<string, unknown>) {
      const result = await getAddressWorkflow(ctx);
      return toResult(result);
    },
  } as AnyAgentTool);
}

function registerHealthCheck(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_health_check',
    label: 'Vault Health Check',
    description: 'Check the health status of the vault signer',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_toolCallId: string, _params: Record<string, unknown>) {
      const result = await healthCheckWorkflow(ctx);
      return toResult(result);
    },
  } as AnyAgentTool);
}

function registerSignDefiCall(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_sign_defi_call',
    label: 'Sign DeFi Call',
    description:
      'Sign a DeFi contract interaction after calldata decoding and policy validation',
    parameters: {
      type: 'object',
      properties: {
        chainId: {
          type: 'number',
          description: 'The chain ID for the transaction',
        },
        to: {
          type: 'string',
          description: 'The target contract address (0x-prefixed)',
        },
        data: {
          type: 'string',
          description: 'The calldata (hex-encoded, 0x-prefixed)',
        },
        value: {
          type: 'string',
          description: 'The value in wei (decimal string)',
        },
      },
      required: ['chainId', 'to', 'data'],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const result = await signDefiCall(ctx, 'vault_sign_defi_call', {
        chainId: params.chainId as number,
        to: params.to as string,
        data: params.data as string,
        value: params.value as string | undefined,
      });
      return toResult(result);
    },
  } as AnyAgentTool);
}

function registerSignPermit(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_sign_permit',
    label: 'Sign EIP-2612 Permit',
    description: 'Sign an EIP-2612 permit after policy validation',
    parameters: {
      type: 'object',
      properties: {
        chainId: { type: 'number', description: 'The chain ID' },
        token: {
          type: 'string',
          description: 'The token contract address (0x-prefixed)',
        },
        spender: {
          type: 'string',
          description: 'The spender address (0x-prefixed)',
        },
        value: {
          type: 'string',
          description: 'The permit value in wei (decimal string)',
        },
        deadline: {
          type: 'number',
          description: 'The permit deadline (unix timestamp)',
        },
        domain: { type: 'object', description: 'The EIP-712 domain' },
        types: { type: 'object', description: 'The EIP-712 types' },
        message: { type: 'object', description: 'The EIP-712 message' },
      },
      required: [
        'chainId',
        'token',
        'spender',
        'value',
        'deadline',
        'domain',
        'types',
        'message',
      ],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const result = await signPermit(ctx, {
        chainId: params.chainId as number,
        token: params.token as string,
        spender: params.spender as string,
        value: params.value as string,
        deadline: params.deadline as number,
        domain: params.domain as Record<string, unknown>,
        types: params.types as Record<string, unknown>,
        message: params.message as Record<string, unknown>,
      });
      return toResult(result);
    },
  } as AnyAgentTool);
}

function registerGetBalance(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_get_balance',
    label: 'Get Balance',
    description: 'Query native ETH or ERC20 token balance for an address',
    parameters: {
      type: 'object',
      properties: {
        chainId: {
          type: 'number',
          description: 'The chain ID to query',
        },
        address: {
          type: 'string',
          description: 'The address to query (defaults to vault address)',
        },
        token: {
          type: 'string',
          description: 'ERC20 token address (omit for native ETH balance)',
        },
      },
      required: ['chainId'],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const result = await getBalanceWorkflow(ctx, {
        chainId: params.chainId as number,
        address: params.address as string | undefined,
        token: params.token as string | undefined,
      });
      return toResult(result);
    },
  } as AnyAgentTool);
}

function registerSendTransfer(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_send_transfer',
    label: 'Send ETH Transfer',
    description: 'Send native ETH transfer after policy validation, sign and broadcast',
    parameters: {
      type: 'object',
      properties: {
        chainId: {
          type: 'number',
          description: 'The chain ID for the transaction',
        },
        to: {
          type: 'string',
          description: 'The recipient address (0x-prefixed)',
        },
        value: {
          type: 'string',
          description: 'Amount in wei (decimal string)',
        },
      },
      required: ['chainId', 'to', 'value'],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const result = await sendTransfer(ctx, {
        chainId: params.chainId as number,
        to: params.to as string,
        value: params.value as string,
      });
      return toResult(result);
    },
  } as AnyAgentTool);
}

function registerSendErc20Transfer(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool({
    name: 'vault_send_erc20_transfer',
    label: 'Send ERC20 Transfer',
    description: 'Send ERC20 token transfer after policy validation, sign and broadcast',
    parameters: {
      type: 'object',
      properties: {
        chainId: {
          type: 'number',
          description: 'The chain ID for the transaction',
        },
        token: {
          type: 'string',
          description: 'The ERC20 token contract address (0x-prefixed)',
        },
        to: {
          type: 'string',
          description: 'The recipient address (0x-prefixed)',
        },
        amount: {
          type: 'string',
          description: 'Amount in smallest unit (decimal string)',
        },
      },
      required: ['chainId', 'token', 'to', 'amount'],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const result = await sendErc20Transfer(ctx, {
        chainId: params.chainId as number,
        token: params.token as string,
        to: params.to as string,
        amount: params.amount as string,
      });
      return toResult(result);
    },
  } as AnyAgentTool);
}

// ─── Dual-Gated Tools (only with enableUnsafeRawSign) ───

function registerSignTransaction(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    {
      name: 'vault_sign_transaction',
      label: 'Sign Raw Transaction',
      description:
        '[UNSAFE] Sign a raw EVM transaction. Only available when enableUnsafeRawSign is configured.',
      parameters: {
        type: 'object',
        properties: {
          chainId: { type: 'number', description: 'The chain ID' },
          to: {
            type: 'string',
            description: 'The target address (0x-prefixed)',
          },
          data: {
            type: 'string',
            description: 'The calldata (hex-encoded)',
          },
          value: {
            type: 'string',
            description: 'The value in wei (decimal string)',
          },
          nonce: { type: 'number', description: 'The transaction nonce' },
          gas: {
            type: 'string',
            description: 'The gas limit (decimal string)',
          },
          maxFeePerGas: {
            type: 'string',
            description: 'Max fee per gas in wei',
          },
          maxPriorityFeePerGas: {
            type: 'string',
            description: 'Max priority fee per gas in wei',
          },
        },
        required: ['chainId', 'to'],
      },
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        if (!ctx.signer) {
          ctx.auditSink.log({
            service: ctx.service ?? 'agentic-vault-openclaw',
            action: 'vault_sign_transaction',
            who: ctx.caller,
            what: 'Signer not available for raw transaction signing',
            why: 'Configuration error: signer is required',
            result: 'error',
          });
          return {
            content: [{ type: 'text' as const, text: 'Error: Signer is not available' }],
            details: undefined,
          };
        }

        try {
          const to = (params.to as string).toLowerCase() as `0x${string}`;
          const tx: Record<string, unknown> = {
            chainId: params.chainId as number,
            to,
            type: 'eip1559',
          };
          if (params.data) tx.data = params.data;
          if (params.value) tx.value = BigInt(params.value as string);
          if (params.nonce !== undefined) tx.nonce = params.nonce;
          if (params.gas) tx.gas = BigInt(params.gas as string);
          if (params.maxFeePerGas)
            tx.maxFeePerGas = BigInt(params.maxFeePerGas as string);
          if (params.maxPriorityFeePerGas)
            tx.maxPriorityFeePerGas = BigInt(
              params.maxPriorityFeePerGas as string,
            );

          const signedTx = await ctx.signer.signTransaction(tx);

          ctx.auditSink.log({
            service: ctx.service ?? 'agentic-vault-openclaw',
            action: 'vault_sign_transaction',
            who: ctx.caller,
            what: `Signed raw transaction to ${to} on chain ${params.chainId as number}`,
            why: 'Raw transaction signing (enableUnsafeRawSign enabled)',
            result: 'approved',
            details: { chainId: params.chainId as number, to },
          });

          return {
            content: [{ type: 'text' as const, text: signedTx }],
            details: undefined,
          };
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : String(error);

          ctx.auditSink.log({
            service: ctx.service ?? 'agentic-vault-openclaw',
            action: 'vault_sign_transaction',
            who: ctx.caller,
            what: `Failed to sign raw transaction to ${params.to as string}`,
            why: 'Signing error',
            result: 'error',
            details: { error: msg },
          });

          return {
            content: [{ type: 'text' as const, text: `Signing error: ${msg}` }],
            details: undefined,
          };
        }
      },
    } as AnyAgentTool,
    { optional: true },
  );
}

function registerSignTypedData(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    {
      name: 'vault_sign_typed_data',
      label: 'Sign Raw Typed Data',
      description:
        '[UNSAFE] Sign raw EIP-712 typed data. Only available when enableUnsafeRawSign is configured.',
      parameters: {
        type: 'object',
        properties: {
          domain: { type: 'object', description: 'The EIP-712 domain' },
          types: { type: 'object', description: 'The EIP-712 types' },
          primaryType: {
            type: 'string',
            description: 'The primary type name',
          },
          message: { type: 'object', description: 'The EIP-712 message' },
        },
        required: ['domain', 'types', 'primaryType', 'message'],
      },
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        if (!ctx.signer) {
          ctx.auditSink.log({
            service: ctx.service ?? 'agentic-vault-openclaw',
            action: 'vault_sign_typed_data',
            who: ctx.caller,
            what: 'Signer not available for typed data signing',
            why: 'Configuration error: signer is required',
            result: 'error',
          });
          return {
            content: [{ type: 'text' as const, text: 'Error: Signer is not available' }],
            details: undefined,
          };
        }

        try {
          const sig = await ctx.signer.signTypedData({
            domain: params.domain as Record<string, unknown>,
            types: params.types as Record<string, unknown>,
            primaryType: params.primaryType as string,
            message: params.message as Record<string, unknown>,
          });

          ctx.auditSink.log({
            service: ctx.service ?? 'agentic-vault-openclaw',
            action: 'vault_sign_typed_data',
            who: ctx.caller,
            what: `Signed typed data with primaryType ${params.primaryType as string}`,
            why: 'Raw typed data signing (enableUnsafeRawSign enabled)',
            result: 'approved',
            details: { primaryType: params.primaryType as string },
          });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(sig) }],
            details: undefined,
          };
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : String(error);

          ctx.auditSink.log({
            service: ctx.service ?? 'agentic-vault-openclaw',
            action: 'vault_sign_typed_data',
            who: ctx.caller,
            what: `Failed to sign typed data with primaryType ${params.primaryType as string}`,
            why: 'Signing error',
            result: 'error',
            details: { error: msg },
          });

          return {
            content: [{ type: 'text' as const, text: `Signing error: ${msg}` }],
            details: undefined,
          };
        }
      },
    } as AnyAgentTool,
    { optional: true },
  );
}

// ─── Public Registration ───

/**
 * Register all OpenClaw tools.
 * 7 safe tools are always registered.
 * 2 dual-gated tools are only registered when enableUnsafeRawSign is true.
 */
export function registerTools(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
  config: OpenClawPluginConfig,
): void {
  // Safe tools — always registered
  registerGetAddress(api, ctx);
  registerHealthCheck(api, ctx);
  registerSignDefiCall(api, ctx);
  registerSignPermit(api, ctx);
  registerGetBalance(api, ctx);
  registerSendTransfer(api, ctx);
  registerSendErc20Transfer(api, ctx);

  // Dual-gated tools — only with enableUnsafeRawSign
  if (config.enableUnsafeRawSign) {
    registerSignTransaction(api, ctx);
    registerSignTypedData(api, ctx);
  }
}
