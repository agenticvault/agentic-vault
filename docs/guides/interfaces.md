# Interfaces

Agentic Vault supports 4 interfaces. Choose the one that fits your use case.

| Interface | Use Case | Requires AWS |
|-----------|----------|:---:|
| [TypeScript Library](#1-typescript-library) | Embed signing in your app | Yes |
| [CLI](#2-cli) | Command-line signing + dry-run | Partial |
| [MCP Server](#3-mcp-server-for-ai-agents) | Expose wallet to AI agents | Yes |
| [OpenClaw Plugin](#4-openclaw-plugin) | Use as OpenClaw agent tool | Yes |

## 1. TypeScript Library

```typescript
import { createSigningProvider, EvmSignerAdapter } from '@agenticvault/agentic-vault';

const provider = createSigningProvider({
  provider: 'aws-kms',
  keyId: 'arn:aws:kms:us-east-1:123456789:key/your-key-id',
  region: 'us-east-1',
});

const signer = new EvmSignerAdapter(provider);
const address = await signer.getAddress();
```

For DeFi protocol decoding and policy evaluation:

```typescript
import { ProtocolDispatcher, createDefaultRegistry } from '@agenticvault/agentic-vault/protocols';

const dispatcher = new ProtocolDispatcher(createDefaultRegistry());
// Pass full ABI-encoded calldata (selector + parameters)
const intent = dispatcher.dispatch(1, '0xContractAddress', calldata);
// -> { protocol: 'erc20', action: 'approve', args: { spender, amount } }
```

## 2. CLI

```bash
# Sign a DeFi transaction (decoded + policy validated)
agentic-vault sign --chain-id 1 --to 0x... --data 0x095ea7b3...

# Dry-run: decode + policy check without signing
agentic-vault dry-run --chain-id 1 --to 0x... --data 0x095ea7b3...

# Encode intent parameters into calldata
agentic-vault encode erc20:approve --spender 0x... --amount 1000000

# Decode calldata into intent JSON
agentic-vault decode --chain-id 1 --to 0x... --data 0x095ea7b3...

# Get wallet address
agentic-vault get-address

# Check signer health
agentic-vault health

# Start MCP stdio server
agentic-vault mcp
```

| Command | Description | Requires AWS |
|---------|-------------|:---:|
| `sign` | Decode calldata, policy check, sign | Yes |
| `sign-permit` | Sign an EIP-2612 permit | Yes |
| `dry-run` | Decode + policy check (no signing) | No |
| `encode` | Intent params to calldata hex | No |
| `decode` | Calldata hex to intent JSON | No |
| `get-address` | Derive signer address | Yes |
| `health` | Check KMS key accessibility | Yes |
| `mcp` | Start MCP stdio server | Yes |

Global options: `--key-id`, `--region`, `--expected-address`, `--policy-config`, `--output` (json/human/raw). The `sign` command also accepts `--yes` to skip TTY confirmation.

> **Note**: The `agentic-vault mcp` subcommand starts a basic MCP server without RPC connectivity. For balance/transfer tools, use the dedicated `agentic-vault-mcp` binary (see [MCP Server](#3-mcp-server-for-ai-agents)).

## 3. MCP Server (for AI Agents)

The MCP server exposes wallet operations as tools that AI agents can call over stdio.

```bash
npx -y -p @agenticvault/agentic-vault agentic-vault-mcp \
  --key-id arn:aws:kms:us-east-1:123456789:key/your-key-id \
  --region us-east-1 \
  --policy-config ./policy.json
```

### MCP Tools

| Tool | Description | Default | Requires |
|------|-------------|---------|----------|
| `get_address` | Get the wallet's Ethereum address | Enabled | — |
| `health_check` | Verify KMS key configuration and connectivity | Enabled | — |
| `get_balance` | Query native ETH or ERC20 token balance | Enabled | — |
| `send_transfer` | Send native ETH transfer (policy-validated) | Enabled | — |
| `send_erc20_transfer` | Send ERC20 token transfer (policy-validated) | Enabled | — |
| `sign_defi_call` | Sign a DeFi transaction with calldata decoding + policy | Enabled | — |
| `sign_swap` | Sign a swap transaction (routes through decoder pipeline) | Enabled | — |
| `sign_permit` | Sign an EIP-2612 permit (policy-constrained) | Enabled | — |
| `sign_transaction` | Raw transaction signing | Disabled | `--unsafe-raw-sign` |
| `sign_typed_data` | Raw EIP-712 typed data signing | Disabled | `--unsafe-raw-sign` |

To enable raw signing tools, add `--unsafe-raw-sign` to the MCP server command.

Balance and transfer tools use public RPCs by default for supported chains (Ethereum, Sepolia, Arbitrum, Base, Polygon). For other chains, pass `--rpc-url <endpoint>` or set `VAULT_RPC_URL`.

### Claude Desktop / Claude Code Configuration

Add to your MCP config (see [`.mcp.json.example`](../../.mcp.json.example)):

```json
{
  "mcpServers": {
    "agentic-vault": {
      "command": "npx",
      "args": [
        "-y", "-p", "@agenticvault/agentic-vault",
        "agentic-vault-mcp",
        "--key-id", "YOUR_KMS_KEY_ID",
        "--region", "us-east-1"
      ],
      "env": {
        "AWS_ACCESS_KEY_ID": "${AWS_ACCESS_KEY_ID}",
        "AWS_SECRET_ACCESS_KEY": "${AWS_SECRET_ACCESS_KEY}",
        "AWS_SESSION_TOKEN": "${AWS_SESSION_TOKEN}"
      }
    }
  }
}
```

## 4. OpenClaw Plugin

Install [`@agenticvault/openclaw`](../../packages/openclaw-plugin/) to use agentic-vault as an OpenClaw agent tool:

```bash
npm install @agenticvault/openclaw @agenticvault/agentic-vault
```

7 safe tools are always registered (`vault_get_address`, `vault_health_check`, `vault_sign_defi_call`, `vault_sign_permit`, `vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer`). 2 additional tools (`vault_sign_transaction`, `vault_sign_typed_data`) require `enableUnsafeRawSign: true` in config. Balance and transfer tools require `rpcUrl` in the plugin config.

See the [OpenClaw plugin package](../../packages/openclaw-plugin/) for configuration details.
