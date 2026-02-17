import {
  signDefiCall,
  signPermit,
  getAddressWorkflow,
  healthCheckWorkflow,
  type WorkflowContext,
  type WorkflowResult,
} from '@agenticvault/agentic-vault/protocols';
import {
  type OpenClawPluginApi,
  type OpenClawPluginConfig,
  type OpenClawToolResult,
} from './types.js';

// ─── Result Adapter ───

function toResult(result: WorkflowResult): OpenClawToolResult {
  switch (result.status) {
    case 'approved':
      return { content: [{ type: 'text', text: result.data }] };
    case 'dry-run-approved': {
      const replacer = (_k: string, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v;
      return {
        content: [
          { type: 'text', text: JSON.stringify(result.details, replacer) },
        ],
      };
    }
    case 'denied':
      return { content: [{ type: 'text', text: result.reason }] };
    case 'error':
      return { content: [{ type: 'text', text: `Error: ${result.reason}` }] };
  }
}

// ─── Safe Tools (always registered) ───

function registerGetAddress(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    'vault_get_address',
    {
      description: 'Get the wallet address managed by this vault',
    },
    async () => {
      const result = await getAddressWorkflow(ctx);
      return toResult(result);
    },
  );
}

function registerHealthCheck(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    'vault_health_check',
    {
      description: 'Check the health status of the vault signer',
    },
    async () => {
      const result = await healthCheckWorkflow(ctx);
      return toResult(result);
    },
  );
}

function registerSignDefiCall(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    'vault_sign_defi_call',
    {
      description:
        'Sign a DeFi contract interaction after calldata decoding and policy validation',
      parameters: {
        chainId: {
          type: 'number',
          description: 'The chain ID for the transaction',
          required: true,
        },
        to: {
          type: 'string',
          description: 'The target contract address (0x-prefixed)',
          required: true,
        },
        data: {
          type: 'string',
          description: 'The calldata (hex-encoded, 0x-prefixed)',
          required: true,
        },
        value: {
          type: 'string',
          description: 'The value in wei (decimal string)',
        },
      },
    },
    async (args) => {
      const result = await signDefiCall(ctx, 'vault_sign_defi_call', {
        chainId: args.chainId as number,
        to: args.to as string,
        data: args.data as string,
        value: args.value as string | undefined,
      });
      return toResult(result);
    },
  );
}

function registerSignPermit(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    'vault_sign_permit',
    {
      description: 'Sign an EIP-2612 permit after policy validation',
      parameters: {
        chainId: {
          type: 'number',
          description: 'The chain ID',
          required: true,
        },
        token: {
          type: 'string',
          description: 'The token contract address (0x-prefixed)',
          required: true,
        },
        spender: {
          type: 'string',
          description: 'The spender address (0x-prefixed)',
          required: true,
        },
        value: {
          type: 'string',
          description: 'The permit value in wei (decimal string)',
          required: true,
        },
        deadline: {
          type: 'number',
          description: 'The permit deadline (unix timestamp)',
          required: true,
        },
        domain: {
          type: 'object',
          description: 'The EIP-712 domain',
          required: true,
        },
        types: {
          type: 'object',
          description: 'The EIP-712 types',
          required: true,
        },
        message: {
          type: 'object',
          description: 'The EIP-712 message',
          required: true,
        },
      },
    },
    async (args) => {
      const result = await signPermit(ctx, {
        chainId: args.chainId as number,
        token: args.token as string,
        spender: args.spender as string,
        value: args.value as string,
        deadline: args.deadline as number,
        domain: args.domain as Record<string, unknown>,
        types: args.types as Record<string, unknown>,
        message: args.message as Record<string, unknown>,
      });
      return toResult(result);
    },
  );
}

// ─── Dual-Gated Tools (only with enableUnsafeRawSign) ───

function registerSignTransaction(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    'vault_sign_transaction',
    {
      description:
        '[UNSAFE] Sign a raw EVM transaction. Only available when enableUnsafeRawSign is configured.',
      parameters: {
        chainId: {
          type: 'number',
          description: 'The chain ID',
          required: true,
        },
        to: {
          type: 'string',
          description: 'The target address (0x-prefixed)',
          required: true,
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
      optional: true,
    },
    async (args) => {
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
          content: [{ type: 'text', text: 'Error: Signer is not available' }],
        };
      }

      try {
        const to = (args.to as string).toLowerCase() as `0x${string}`;
        const tx: Record<string, unknown> = {
          chainId: args.chainId as number,
          to,
          type: 'eip1559',
        };
        if (args.data) tx.data = args.data;
        if (args.value) tx.value = BigInt(args.value as string);
        if (args.nonce !== undefined) tx.nonce = args.nonce;
        if (args.gas) tx.gas = BigInt(args.gas as string);
        if (args.maxFeePerGas)
          tx.maxFeePerGas = BigInt(args.maxFeePerGas as string);
        if (args.maxPriorityFeePerGas)
          tx.maxPriorityFeePerGas = BigInt(
            args.maxPriorityFeePerGas as string,
          );

        const signedTx = await ctx.signer.signTransaction(tx);

        ctx.auditSink.log({
          service: ctx.service ?? 'agentic-vault-openclaw',
          action: 'vault_sign_transaction',
          who: ctx.caller,
          what: `Signed raw transaction to ${to} on chain ${args.chainId as number}`,
          why: 'Raw transaction signing (enableUnsafeRawSign enabled)',
          result: 'approved',
          details: { chainId: args.chainId as number, to },
        });

        return { content: [{ type: 'text', text: signedTx }] };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error);

        ctx.auditSink.log({
          service: ctx.service ?? 'agentic-vault-openclaw',
          action: 'vault_sign_transaction',
          who: ctx.caller,
          what: `Failed to sign raw transaction to ${args.to as string}`,
          why: 'Signing error',
          result: 'error',
          details: { error: msg },
        });

        return {
          content: [{ type: 'text', text: `Signing error: ${msg}` }],
        };
      }
    },
  );
}

function registerSignTypedData(
  api: OpenClawPluginApi,
  ctx: WorkflowContext,
): void {
  api.registerTool(
    'vault_sign_typed_data',
    {
      description:
        '[UNSAFE] Sign raw EIP-712 typed data. Only available when enableUnsafeRawSign is configured.',
      parameters: {
        domain: {
          type: 'object',
          description: 'The EIP-712 domain',
          required: true,
        },
        types: {
          type: 'object',
          description: 'The EIP-712 types',
          required: true,
        },
        primaryType: {
          type: 'string',
          description: 'The primary type name',
          required: true,
        },
        message: {
          type: 'object',
          description: 'The EIP-712 message',
          required: true,
        },
      },
      optional: true,
    },
    async (args) => {
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
          content: [{ type: 'text', text: 'Error: Signer is not available' }],
        };
      }

      try {
        const sig = await ctx.signer.signTypedData({
          domain: args.domain as Record<string, unknown>,
          types: args.types as Record<string, unknown>,
          primaryType: args.primaryType as string,
          message: args.message as Record<string, unknown>,
        });

        ctx.auditSink.log({
          service: ctx.service ?? 'agentic-vault-openclaw',
          action: 'vault_sign_typed_data',
          who: ctx.caller,
          what: `Signed typed data with primaryType ${args.primaryType as string}`,
          why: 'Raw typed data signing (enableUnsafeRawSign enabled)',
          result: 'approved',
          details: { primaryType: args.primaryType as string },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(sig) }],
        };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error);

        ctx.auditSink.log({
          service: ctx.service ?? 'agentic-vault-openclaw',
          action: 'vault_sign_typed_data',
          who: ctx.caller,
          what: `Failed to sign typed data with primaryType ${args.primaryType as string}`,
          why: 'Signing error',
          result: 'error',
          details: { error: msg },
        });

        return {
          content: [{ type: 'text', text: `Signing error: ${msg}` }],
        };
      }
    },
  );
}

// ─── Public Registration ───

/**
 * Register all OpenClaw tools.
 * 4 safe tools are always registered.
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

  // Dual-gated tools — only with enableUnsafeRawSign
  if (config.enableUnsafeRawSign) {
    registerSignTransaction(api, ctx);
    registerSignTypedData(api, ctx);
  }
}
