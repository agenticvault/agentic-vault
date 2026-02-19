# @agenticvault/openclaw

English | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

OpenClaw plugin for [Agentic Vault](https://github.com/agenticvault/agentic-vault) -- expose server-side EVM signing as OpenClaw agent tools with deny-by-default policy enforcement.

## Installation

### Via OpenClaw Host Config (Recommended)

Install the package and its peer dependency, then register it in your OpenClaw host config:

```bash
npm install @agenticvault/openclaw openclaw
```

### Via `plugins.load.paths` (Manual)

If you prefer explicit control over plugin loading, install the package to a local directory and point OpenClaw to it:

```bash
# Install to a local directory
mkdir -p ./openclaw-plugins
cd ./openclaw-plugins
npm install @agenticvault/openclaw
```

Then add the path to your OpenClaw host config:

```json
{
  "plugins": {
    "load": {
      "paths": ["./openclaw-plugins/node_modules/@agenticvault/openclaw"]
    }
  }
}
```

> **Tip**: Pin the exact version in production (`npm install @agenticvault/openclaw@0.1.1`) to avoid unexpected upgrades.

> **Known limitation**: `openclaw plugins install @agenticvault/openclaw` may encounter an installer ID mismatch. Use one of the methods above until this is resolved upstream.

## Configuration

Register the plugin in your OpenClaw host configuration. The entries key must match the manifest `id` (`"agentic-vault"`):

```json
{
  "plugins": {
    "entries": {
      "agentic-vault": {
        "config": {
          "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
          "region": "us-east-1",
          "policyConfigPath": "./policy.json",
          "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
        }
      }
    }
  }
}
```

| Option | Required | Description |
|--------|----------|-------------|
| `keyId` | Yes | AWS KMS key ARN |
| `region` | Yes | AWS region |
| `policyConfigPath` | No | Path to policy JSON file (deny-all by default when omitted) |
| `rpcUrl` | No | RPC endpoint for balance/transfer tools. Required to use `vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer`. |
| `expectedAddress` | No | Expected wallet address for verification |
| `enableUnsafeRawSign` | No | Enable raw signing tools (default: `false`) |

## Available Tools

### Safe Tools (always registered)

| Tool | Description |
|------|-------------|
| `vault_get_address` | Get the wallet address managed by this vault |
| `vault_health_check` | Check the health status of the vault signer |
| `vault_sign_defi_call` | Sign a DeFi contract interaction after calldata decoding and policy validation |
| `vault_sign_permit` | Sign an EIP-2612 permit after policy validation |
| `vault_get_balance` | Query native or ERC20 token balance (requires `rpcUrl`) |
| `vault_send_transfer` | Send native ETH transfer with policy validation (requires `rpcUrl`) |
| `vault_send_erc20_transfer` | Send ERC20 token transfer with policy validation (requires `rpcUrl`) |

### Dual-Gated Tools (requires `enableUnsafeRawSign: true`)

| Tool | Description |
|------|-------------|
| `vault_sign_transaction` | Sign a raw EVM transaction (bypasses decoder pipeline) |
| `vault_sign_typed_data` | Sign raw EIP-712 typed data (bypasses decoder pipeline) |

## Migration from Pre-Release API

The plugin entry point changed from the pre-release `register(api, config)` to the official SDK contract `export default function(api)`:

| Before (pre-release) | After (current) |
|----------------------|-----------------|
| `import { register } from "@agenticvault/openclaw"` | `export default function(api)` |
| `register(api, config)` | Config read from `api.pluginConfig` |
| `api.registerTool(name, config, handler)` | `api.registerTool({ name, description, parameters, label, execute })` |

The plugin now uses the official `openclaw/plugin-sdk` types and can be discovered by the OpenClaw gateway via the `openclaw` field in `package.json`.

## Security

- **Deny by default** -- all signing operations require explicit policy approval
- **Fail-closed** -- unknown calldata is always rejected
- **Dual-gated raw signing** -- `vault_sign_transaction` and `vault_sign_typed_data` are disabled by default; enabling requires `enableUnsafeRawSign: true` in the plugin config
- **Audit trail** -- every operation is logged as structured JSON

## Policy Configuration

See the main repository's [policy configuration docs](https://github.com/agenticvault/agentic-vault#configuration) and [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) for a complete example.

## License

[MIT](LICENSE)
