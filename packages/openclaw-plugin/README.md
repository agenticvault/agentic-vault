# @agenticvault/agentic-vault-openclaw

English | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

OpenClaw plugin for [Agentic Vault](https://github.com/agenticvault/agentic-vault) -- expose server-side EVM signing as OpenClaw agent tools with deny-by-default policy enforcement.

## Installation

### One-Command Install (Recommended)

```bash
npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup
```

This copies the plugin files to `~/.openclaw/extensions/agentic-vault-openclaw/`, installs runtime dependencies, and prints a config snippet. Follow the on-screen instructions to complete setup.

### Quick Start (Manual)

Install the package and copy it to the OpenClaw extensions directory:

```bash
npm install @agenticvault/agentic-vault-openclaw
mkdir -p ~/.openclaw/extensions/agentic-vault-openclaw
cp -r ./node_modules/@agenticvault/agentic-vault-openclaw/* ~/.openclaw/extensions/agentic-vault-openclaw/
cd ~/.openclaw/extensions/agentic-vault-openclaw && npm install --omit=dev --ignore-scripts
```

OpenClaw auto-discovers plugins in `~/.openclaw/extensions/`. The directory name must match the manifest `id` (`agentic-vault-openclaw`).

### From Tarball (No Local node_modules)

Download and extract directly without a project-level install:

```bash
npm pack @agenticvault/agentic-vault-openclaw --pack-destination /tmp
mkdir -p ~/.openclaw/extensions/agentic-vault-openclaw
tar -xzf /tmp/agenticvault-agentic-vault-openclaw-*.tgz -C ~/.openclaw/extensions/agentic-vault-openclaw --strip-components=1
cd ~/.openclaw/extensions/agentic-vault-openclaw && npm install --omit=dev --ignore-scripts
```

### For Development (Symlink)

During plugin development, symlink to the extensions directory:

```bash
mkdir -p ~/.openclaw/extensions
ln -sfn "$(pwd)/packages/openclaw-plugin" ~/.openclaw/extensions/agentic-vault-openclaw
```

### Via `plugins.load.paths` (Advanced)

For explicit control over plugin loading paths:

```bash
mkdir -p /home/user/my-workspace/.openclaw/extensions
cd /home/user/my-workspace/.openclaw/extensions
npm install @agenticvault/agentic-vault-openclaw
```

Then add to your OpenClaw host config (use absolute paths for production/daemon environments):

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/user/my-workspace/.openclaw/extensions/node_modules/@agenticvault/agentic-vault-openclaw"]
    }
  }
}
```

> **Tip**: Pin the exact version in production (`npm install @agenticvault/agentic-vault-openclaw@0.1.3`) to avoid unexpected upgrades.

## Configuration

Register the plugin in your OpenClaw host configuration. The entries key must match the manifest `id` (`"agentic-vault-openclaw"`). If your OpenClaw config uses `plugins.allow`, include `"agentic-vault-openclaw"` in the list:

```json
{
  "plugins": {
    "allow": ["agentic-vault-openclaw"],
    "entries": {
      "agentic-vault-openclaw": {
        "config": {
          "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
          "region": "us-east-1",
          "policyConfigPath": "/home/user/agentic-vault/policy.json",
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
| `import { register } from "@agenticvault/agentic-vault-openclaw"` | `export default function(api)` |
| `register(api, config)` | Config read from `api.pluginConfig` |
| `api.registerTool(name, config, handler)` | `api.registerTool({ name, description, parameters, label, execute })` |

The plugin now uses the official `openclaw/plugin-sdk` types and can be discovered by the OpenClaw gateway via the `openclaw` field in `package.json`.

## Security

- **Deny by default** -- all signing operations require explicit policy approval
- **Fail-closed** -- unknown calldata is always rejected
- **Dual-gated raw signing** -- `vault_sign_transaction` and `vault_sign_typed_data` are disabled by default; enabling requires `enableUnsafeRawSign: true` in the plugin config
- **Audit trail** -- every operation is logged as structured JSON

## Multi-Agent Hardening

In multi-agent environments, restrict vault tools to only the designated financial agent. Add all `vault_*` tool names to `tools.deny` in non-financial agents:

```json
{
  "agents": {
    "general-assistant": {
      "tools": {
        "deny": [
          "vault_get_address", "vault_health_check", "vault_get_balance",
          "vault_sign_defi_call", "vault_sign_permit",
          "vault_send_transfer", "vault_send_erc20_transfer",
          "vault_sign_transaction", "vault_sign_typed_data"
        ]
      }
    }
  }
}
```

## Policy Configuration

See the main repository's [policy configuration docs](https://github.com/agenticvault/agentic-vault#configuration) and [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) for a complete example.

## License

[MIT](LICENSE)
