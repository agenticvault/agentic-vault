> [← Overview](./0-overview.md) | [Document Index](./0-overview.md#document-index)

## 4. Module Specifications

### 4.1 Protocol Decoders

Each decoder module follows the same pattern:

```typescript
// src/protocols/decoders/erc20.ts

import { decodeFunctionData, type Address, type Hex } from 'viem';
import type { DecodedIntent, ProtocolDecoder } from '../types.js';

const erc20Abi = [
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const erc20Decoder: ProtocolDecoder = {
  protocol: 'erc20',
  supportedSelectors: ['0x095ea7b3', '0xa9059cbb'],  // approve, transfer

  decode(chainId: number, to: Address, data: Hex): DecodedIntent {
    try {
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data });
      const selector = data.slice(0, 10).toLowerCase() as Hex;

      switch (functionName) {
        case 'approve':
          return {
            protocol: 'erc20', action: 'approve',
            chainId, to, selector,
            args: { spender: args[0], amount: args[1] },
          };
        case 'transfer':
          return {
            protocol: 'erc20', action: 'transfer',
            chainId, to, selector,
            args: { to: args[0], amount: args[1] },
          };
        default:
          return { protocol: 'unknown', chainId, to, selector, rawData: data,
                   reason: `Unsupported ERC-20 function: ${functionName}` };
      }
    } catch {
      return { protocol: 'unknown', chainId, to, rawData: data,
               reason: 'Failed to decode ERC-20 calldata' };
    }
  },
};
```

Uniswap V3 and Aave V3 decoders follow the same pattern with their respective ABI fragments (see [feasibility study](../0-feasibility-study.md#aave-v3-pool-abi-reference-viem-native) for ABI references).

### 4.2 Dispatcher

```typescript
// src/protocols/dispatcher.ts

import type { Address, Hex } from 'viem';
import type { DecodedIntent } from './types.js';
import { ProtocolRegistry, type RegistryConfig } from './registry.js';

export class ProtocolDispatcher {
  private readonly registry: ProtocolRegistry;

  constructor(config: RegistryConfig) {
    this.registry = new ProtocolRegistry(config);
  }

  dispatch(chainId: number, to: Address, data: Hex): DecodedIntent {
    if (data.length < 10) {
      return {
        protocol: 'unknown', chainId, to, rawData: data,
        reason: 'Calldata too short (no 4-byte selector)',
      };
    }

    const selector = data.slice(0, 10).toLowerCase() as Hex;
    const decoder = this.registry.resolve(chainId, to, selector);

    if (!decoder) {
      return {
        protocol: 'unknown', chainId, to, selector, rawData: data,
        reason: `No registered decoder for contract ${to} on chain ${chainId}`,
      };
    }

    return decoder.decode(chainId, to, data);
  }
}
```

### 4.3 Policy Engine V2

```typescript
// src/protocols/policy/engine.ts (moved from src/agentic/policy/, evolved in place)

export class PolicyEngine {
  private readonly config: PolicyConfigV2;
  private readonly evaluators: Map<string, ProtocolPolicyEvaluator>;

  constructor(config: PolicyConfigV2, evaluators?: ProtocolPolicyEvaluator[]) {
    this.config = config;
    this.evaluators = new Map(
      (evaluators ?? []).map((e) => [e.protocol, e]),
    );
  }

  evaluate(request: PolicyRequestV2): PolicyEvaluation {
    const violations: string[] = [];

    // -- V1 base checks (unchanged) --
    violations.push(...this.evaluateBase(request));

    // -- V2 intent-aware checks (fail-closed) --
    if (request.intent && request.intent.protocol !== 'unknown') {
      const evaluator = this.evaluators.get(request.intent.protocol);
      const protocolConfig = this.config.protocolPolicies?.[request.intent.protocol];

      if (!evaluator || !protocolConfig) {
        // Fail-closed: deny if protocol is known but evaluator/config missing
        violations.push(
          `No policy evaluator/config registered for protocol '${request.intent.protocol}'`,
        );
      } else {
        violations.push(...evaluator.evaluate(request.intent, protocolConfig));
      }
    }

    return { allowed: violations.length === 0, violations };
  }

  private evaluateBase(request: PolicyRequest): string[] {
    // ... existing V1 logic (unchanged) ...
  }
}
```

### 4.4 Protocols Public Entrypoint

```typescript
// src/protocols/index.ts

// Types
export type { DecodedIntent, ProtocolDecoder } from './types.js';
export type { ContractEntry, RegistryConfig } from './registry.js';

// Classes
export { ProtocolRegistry } from './registry.js';
export { ProtocolDispatcher } from './dispatcher.js';

// Decoders
export { erc20Decoder } from './decoders/erc20.js';
export { uniswapV3Decoder } from './decoders/uniswap-v3.js';
export { aaveV3Decoder } from './decoders/aave-v3.js';

// Policy V2
export { PolicyEngine } from './policy/engine.js';
export type {
  PolicyConfig, PolicyRequest, PolicyEvaluation,
  PolicyConfigV2, PolicyRequestV2,
  ProtocolPolicyConfig, ProtocolPolicyEvaluator,
} from './policy/types.js';

// Default registry factory
export { createDefaultRegistry } from './registry.js';
```

### 4.5 MCP Tool: `sign_defi_call`

> **Note**: 以下為設計時 pseudocode。實際實作使用 refined zod validators（Phase 5b）和共用 `executeDecodedCallPipeline` helper（Phase 5d），詳見 `src/agentic/mcp/tools/sign-defi-call.ts` 和 `src/agentic/mcp/tools/decoded-call-pipeline.ts`。

```typescript
// src/agentic/mcp/tools/sign-defi-call.ts (simplified pseudocode)

import { z } from 'zod';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ToolContext } from './shared.js';

const inputSchema = {
  chainId: z.number().positive(),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),  // address validation
  data: z.string().regex(/^0x[0-9a-fA-F]+$/),    // hex validation
  value: z.string().optional(),
};

export function registerSignDefiCall(server: McpServer, ctx: ToolContext): void {
  server.registerTool('sign_defi_call', {
    description: 'Sign a DeFi contract interaction after calldata decoding and policy validation',
    inputSchema,
  }, async (args) => {
    const to = args.to.toLowerCase() as `0x${string}`;
    const data = args.data as `0x${string}`;

    // 1. Require dispatcher (runtime guard for optional field)
    if (!ctx.dispatcher) {
      throw new Error('sign_defi_call requires dispatcher in ToolContext');
    }

    // 2. Decode calldata
    const intent = ctx.dispatcher.dispatch(args.chainId, to, data);

    // 3. Reject unknown protocols (fail-closed)
    if (intent.protocol === 'unknown') {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp', action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Rejected unknown calldata for ${to} on chain ${args.chainId}`,
        why: `Decoder rejection: ${intent.reason}`,
        result: 'denied',
        details: { chainId: args.chainId, to, reason: intent.reason },
      });
      return {
        content: [{ type: 'text' as const,
          text: `Rejected: ${intent.reason}` }],
        isError: true,
      };
    }

    // 4. Parse value
    let amountWei: bigint | undefined;
    if (args.value) {
      try { amountWei = BigInt(args.value); }
      catch { return { content: [{ type: 'text' as const, text: 'Invalid value' }], isError: true }; }
    }

    // 5. Policy evaluation with decoded intent
    const evaluation = ctx.policyEngine.evaluate({
      chainId: args.chainId, to,
      selector: 'selector' in intent ? intent.selector : undefined,
      amountWei,
      intent,
    });

    if (!evaluation.allowed) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp', action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Policy denied ${intent.protocol}:${intent.action} on chain ${args.chainId}`,
        why: `Violations: ${evaluation.violations.join('; ')}`,
        result: 'denied',
        details: { chainId: args.chainId, to, protocol: intent.protocol,
                   action: intent.action, violations: evaluation.violations },
      });
      return {
        content: [{ type: 'text' as const,
          text: `Policy denied: ${evaluation.violations.join('; ')}` }],
        isError: true,
      };
    }

    // 6. Sign
    try {
      const signedTx = await ctx.signer.signTransaction({
        chainId: args.chainId, to, data, value: amountWei,
      });

      ctx.auditLogger.log({
        service: 'agentic-vault-mcp', action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Signed ${intent.protocol}:${intent.action} for ${to} on chain ${args.chainId}`,
        why: 'Approved by decoder + policy',
        result: 'approved',
        details: { chainId: args.chainId, to, protocol: intent.protocol, action: intent.action },
      });

      return { content: [{ type: 'text' as const, text: signedTx }] };
    } catch (error) {
      ctx.auditLogger.log({
        service: 'agentic-vault-mcp', action: 'sign_defi_call',
        who: 'mcp-client',
        what: `Failed to sign ${intent.protocol}:${intent.action}`,
        why: 'Signing error',
        result: 'error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      return {
        content: [{ type: 'text' as const,
          text: `Signing error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });
}
```

### 4.6 `sign_swap` Upgrade

The existing `sign_swap` tool is modified to route through the same decoder pipeline:

```diff
 // src/agentic/mcp/tools/sign-swap.ts

 export function registerSignSwap(server: McpServer, ctx: ToolContext): void {
   server.registerTool('sign_swap', { ... }, async (args) => {
     const to = args.to.toLowerCase() as `0x${string}`;
+    const data = args.data as `0x${string}`;
-    const selector = args.data.length >= 10
-      ? (args.data.slice(0, 10).toLowerCase() as `0x${string}`)
-      : undefined;
+
+    // Require dispatcher (runtime guard for optional field)
+    if (!ctx.dispatcher) {
+      throw new Error('sign_swap requires dispatcher in ToolContext');
+    }
+
+    // Decode calldata via protocol dispatcher
+    const intent = ctx.dispatcher.dispatch(args.chainId, to, data);
+
+    // Reject unknown protocols (fail-closed)
+    if (intent.protocol === 'unknown') {
+      // ... audit log + deny ...
+    }

     // Evaluate policy with decoded intent
     const evaluation = ctx.policyEngine.evaluate({
       chainId: args.chainId,
       to,
-      selector,
+      selector: 'selector' in intent ? intent.selector : undefined,
       amountWei,
+      intent,
     });
     // ... rest unchanged ...
```

### 4.7 ToolContext Extension

> **Trust boundary design**: `shared.ts` 不直接 import `protocols/index.js`。所有 interface 使用 local structural types（如 `ToolDecodedIntent`），透過 TypeScript structural typing 與 protocol layer 的實作相容。

```typescript
// src/agentic/mcp/tools/shared.ts (actual implementation)

/** Minimal decoded intent — structural supertype (no import from protocols/) */
export interface ToolDecodedIntent {
  protocol: string;
  chainId: number;
  to: `0x${string}`;
  selector?: `0x${string}`;
  action?: string;
  args?: Record<string, unknown>;
  rawData?: `0x${string}`;
  reason?: string;
}

/** Minimal policy engine interface (V2 — intent-aware) */
export interface ToolPolicyEngine {
  evaluate(request: {
    chainId: number;
    to: `0x${string}`;
    selector?: `0x${string}`;
    amountWei?: bigint;
    deadline?: number;
    intent?: ToolDecodedIntent;
  }): ToolPolicyEvaluation;
}

/** Protocol dispatcher interface */
export interface ToolDispatcher {
  dispatch(chainId: number, to: `0x${string}`, data: `0x${string}`): ToolDecodedIntent;
}

/** Full context */
export interface ToolContext {
  signer: ToolSigner;
  policyEngine: ToolPolicyEngine;
  auditLogger: ToolAuditLogger;
  dispatcher?: ToolDispatcher;  // optional for backward compat; required by sign_defi_call
}
```

**Backward compatibility**: Existing tools (`get_address`, `health_check`, `sign_permit`, `sign_typed_data`) do not use `dispatcher` and work unchanged. `sign_defi_call` and upgraded `sign_swap` check for `dispatcher` at runtime and throw a clear error if missing. The `createMcpServer` factory injects a default `ProtocolDispatcher` when not provided.

```typescript
// src/agentic/mcp/server.ts (updated)
import { ProtocolDispatcher, createDefaultRegistry } from '../../protocols/index.js';

export function createMcpServer(options: McpServerOptions): McpServer {
  const ctx: ToolContext = {
    signer: options.signer,
    policyEngine: options.policyEngine,
    auditLogger: options.auditLogger,
    dispatcher: options.dispatcher ?? new ProtocolDispatcher(createDefaultRegistry()),
  };
  // ...
}
```

### 4.8 Workflow Layer [Phase 6a ✅]

> 來源：Phase 5 完成後的多介面架構 brainstorming（Claude + Codex Nash Equilibrium，2026-02-13）

Workflows 是 **interface-agnostic 的共用業務邏輯**，位於 `src/protocols/workflows/`。MCP tools 和 CLI commands 都是 thin adapters，呼叫 workflow 後各自格式化輸出。業務邏輯已從 `src/agentic/mcp/tools/decoded-call-pipeline.ts` 提取至 workflows。

#### Types

```typescript
// src/protocols/workflows/types.ts

import type { AuditEntry } from '../../agentic/audit/types.js';
import type { DecodedIntent } from '../types.js';

/** Audit sink interface — decouples workflows from concrete logger */
export interface AuditSink {
  log(entry: AuditEntry): void;
}

/** Workflow context — everything a workflow needs */
export interface WorkflowContext {
  signer: WorkflowSigner;
  policyEngine: WorkflowPolicyEngine;
  dispatcher: WorkflowDispatcher;
  auditSink: AuditSink;
  caller: string;  // 'mcp-client' | 'cli' | 'sdk' | custom
}

/** Domain result for sign-defi-call workflow */
export type SignDefiCallResult =
  | { status: 'signed'; signedTx: string; intent: DecodedIntent }
  | { status: 'denied'; violations: string[]; intent?: DecodedIntent }
  | { status: 'error'; error: string };

/** Domain result for sign-permit workflow */
export type SignPermitResult =
  | { status: 'signed'; signature: { v: number; r: string; s: string } }
  | { status: 'denied'; violations: string[] }
  | { status: 'error'; error: string };
```

#### Workflow Implementation Pattern

```typescript
// src/protocols/workflows/sign-defi-call.ts

export async function signDefiCall(
  ctx: WorkflowContext,
  args: { chainId: number; to: Address; data: Hex; value?: string },
): Promise<SignDefiCallResult> {
  // 1. Decode
  const intent = ctx.dispatcher.dispatch(args.chainId, to, data);

  // 2. Reject unknown (fail-closed)
  if (intent.protocol === 'unknown') {
    ctx.auditSink.log({ /* denied, caller: ctx.caller */ });
    return { status: 'denied', violations: [intent.reason] };
  }

  // 3. Policy evaluation with intent
  const evaluation = ctx.policyEngine.evaluate({ ...request, intent });
  if (!evaluation.allowed) {
    ctx.auditSink.log({ /* denied */ });
    return { status: 'denied', violations: evaluation.violations, intent };
  }

  // 4. Sign
  const signedTx = await ctx.signer.signTransaction({ ... });
  ctx.auditSink.log({ /* approved, caller: ctx.caller */ });
  return { status: 'signed', signedTx, intent };
}
```

#### Adapter Pattern

```typescript
// MCP adapter (thin)
async (args) => {
  const result = await signDefiCall(workflowCtx, args);
  if (result.status === 'signed')
    return { content: [{ type: 'text', text: result.signedTx }] };
  return { content: [{ type: 'text', text: result.violations.join('; ') }], isError: true };
}

// CLI adapter (thin)
async (args) => {
  const result = await signDefiCall(workflowCtx, args);
  if (result.status === 'signed')
    console.log(`✓ Signed ${result.intent.protocol}:${result.intent.action}\n${result.signedTx}`);
  else
    console.error(`✗ Denied: ${result.violations.join('\n  ')}`);
}
```

### 4.9 CLI Design [Phase 6b ✅]

> Binary: `agentic-vault` (main) + `agentic-vault-mcp` (compat alias → `agentic-vault mcp`).

| Subcommand | Description | Requires AWS |
| --- | --- | --- |
| `sign` | Decode calldata → policy → sign → output signed tx | Yes |
| `sign-permit` | Validate EIP-2612 permit → sign → output `{v,r,s}` | Yes |
| `dry-run` | Decode calldata → policy check → output intent (no signing) | No |
| `get-address` | Derive signer address from KMS key | Yes |
| `health` | Check KMS key accessibility | Yes |
| `mcp` | Start MCP stdio server (current `cli.ts` behavior) | Yes |

```
# CLI 使用範例
agentic-vault sign --chain-id 1 --to 0x... --data 0x095ea7b3... --key-id alias/my-key --region us-east-1
agentic-vault dry-run --chain-id 1 --to 0x... --data 0x095ea7b3...
agentic-vault mcp --key-id alias/my-key --region us-east-1  # 等同 agentic-vault-mcp
```

**Security parity**: CLI 與 MCP 共用相同的 PolicyEngine、AuditSink、fail-closed 行為。唯一差異在 I/O 格式（human-readable vs MCP JSON-RPC）。

## 5. Contract Registry Configuration

The registry maps `chainId:contractAddress` to protocol decoders. Initially hardcoded, can be moved to config file later.

```typescript
// src/protocols/registry.ts — createDefaultRegistry() (current)

const defaultRegistry: RegistryConfig = {
  contracts: {
    // Uniswap V3 SwapRouter02 (Ethereum mainnet)
    '1:0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': {
      protocol: 'uniswap_v3', decoder: uniswapV3Decoder,
    },
    // Uniswap V3 SwapRouter02 (Sepolia testnet)
    '11155111:0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e': {
      protocol: 'uniswap_v3', decoder: uniswapV3Decoder,
    },
    // Aave V3 Pool (Ethereum mainnet)
    '1:0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': {
      protocol: 'aave_v3', decoder: aaveV3Decoder,
    },
    // Aave V3 Pool (Sepolia testnet)
    '11155111:0x6ae43d3271ff6888e7fc43fd7321a503ff738951': {
      protocol: 'aave_v3', decoder: aaveV3Decoder,
    },
  },
  // ERC-20 matched by selector (any contract)
  interfaceDecoders: [erc20Decoder],
};
```
