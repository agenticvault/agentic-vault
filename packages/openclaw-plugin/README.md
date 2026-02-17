# @agenticvault/openclaw

English | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

OpenClaw plugin for [Agentic Vault](https://github.com/agenticvault/agentic-vault) -- expose server-side EVM signing as OpenClaw agent tools with deny-by-default policy enforcement.

## Installation

```bash
npm install @agenticvault/openclaw @agenticvault/agentic-vault
```

## Configuration

Register the plugin in your OpenClaw agent configuration:

```json
{
  "plugins": {
    "agentic-vault": {
      "package": "@agenticvault/openclaw",
      "config": {
        "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
        "region": "us-east-1",
        "policyConfigPath": "./policy.json"
      }
    }
  }
}
```

## Available Tools

### Safe Tools (always registered)

| Tool | Description |
|------|-------------|
| `vault_get_address` | Get the wallet address managed by this vault |
| `vault_health_check` | Check the health status of the vault signer |
| `vault_sign_defi_call` | Sign a DeFi contract interaction after calldata decoding and policy validation |
| `vault_sign_permit` | Sign an EIP-2612 permit after policy validation |

### Dual-Gated Tools (requires `enableUnsafeRawSign: true`)

| Tool | Description |
|------|-------------|
| `vault_sign_transaction` | Sign a raw EVM transaction (bypasses decoder pipeline) |
| `vault_sign_typed_data` | Sign raw EIP-712 typed data (bypasses decoder pipeline) |

## Security

- **Deny by default** -- all signing operations require explicit policy approval
- **Fail-closed** -- unknown calldata is always rejected
- **Dual-gated raw signing** -- `vault_sign_transaction` and `vault_sign_typed_data` are disabled by default; enabling requires `enableUnsafeRawSign: true` in the plugin config
- **Audit trail** -- every operation is logged as structured JSON

## Policy Configuration

See the main repository's [policy configuration docs](https://github.com/agenticvault/agentic-vault#configuration) and [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) for a complete example.

## License

[MIT](LICENSE)
