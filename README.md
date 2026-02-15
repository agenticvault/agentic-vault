# Agentic Vault

[![npm version](https://img.shields.io/npm/v/@agenticvault/agentic-vault)](https://www.npmjs.com/package/@agenticvault/agentic-vault)
[![CI](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Server-side EVM signing with AWS KMS and built-in DeFi protocol awareness. Expose your wallet to AI agents via MCP, CLI, or OpenClaw with deny-by-default policy enforcement and full audit logging.

## Features

- **HSM-backed signing** -- private keys never leave AWS KMS; only digests are sent for signing
- **DeFi protocol awareness** -- calldata decoding for ERC-20, Uniswap V3, and Aave V3 with protocol-specific policy rules
- **Deny-by-default policy engine** -- chain, contract, selector, amount, deadline, and protocol-level constraints
- **Multiple interfaces** -- use as a TypeScript library, CLI, MCP server, or OpenClaw plugin
- **Audit logging** -- structured JSON audit trail for every signing operation (approved, denied, errored)
- **EVM-native** -- built on [viem](https://viem.sh) with full EIP-712 typed data support

## Quick Start

### Prerequisites

- Node.js >= 22
- AWS KMS key (ECC_SECG_P256K1 / secp256k1) -- see [AWS KMS Setup](#aws-kms-setup)
- AWS credentials configured (SSO, IAM role, or static credentials)

### Install

```bash
npm install @agenticvault/agentic-vault
# or
pnpm add @agenticvault/agentic-vault
```

### Environment Setup

Create a `.env` file (see [`.env.example`](.env.example)):

```bash
VAULT_KEY_ID=alias/my-signing-key
VAULT_REGION=us-east-1
```

Both CLI and MCP server use these as fallbacks when `--key-id` / `--region` flags are omitted.

## Choose Your Interface

### 1. TypeScript Library

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
const intent = dispatcher.dispatch(1, '0xContractAddress', '0x095ea7b3...');
// → { protocol: 'erc20', action: 'approve', args: { spender, amount } }
```

### 2. CLI

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

### 3. MCP Server (for AI Agents)

The MCP server exposes wallet operations as tools that AI agents can call over stdio.

```bash
npx -y -p @agenticvault/agentic-vault agentic-vault-mcp \
  --key-id arn:aws:kms:us-east-1:123456789:key/your-key-id \
  --region us-east-1 \
  --policy-config ./policy.json
```

#### MCP Tools

| Tool | Description | Default |
|------|-------------|---------|
| `get_address` | Get the wallet's Ethereum address | Enabled |
| `health_check` | Verify KMS key configuration and connectivity | Enabled |
| `sign_defi_call` | Sign a DeFi transaction with calldata decoding + policy | Enabled |
| `sign_swap` | Sign a swap transaction (routes through decoder pipeline) | Enabled |
| `sign_permit` | Sign an EIP-2612 permit (policy-constrained) | Enabled |
| `sign_transaction` | Raw transaction signing | Disabled (requires `--unsafe-raw-sign`) |
| `sign_typed_data` | Raw EIP-712 typed data signing | Disabled (requires `--unsafe-raw-sign`) |

To enable raw signing tools, add `--unsafe-raw-sign` to the MCP server command.

#### Claude Desktop / Claude Code Configuration

Add to your MCP config (see [`.mcp.json.example`](.mcp.json.example)):

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

### 4. OpenClaw Plugin

Install [`@agenticvault/openclaw`](packages/openclaw-plugin/) to use agentic-vault as an OpenClaw agent tool:

```bash
npm install @agenticvault/openclaw @agenticvault/agentic-vault
```

4 safe tools are always registered (`vault_get_address`, `vault_health_check`, `vault_sign_defi_call`, `vault_sign_permit`). 2 additional tools (`vault_sign_transaction`, `vault_sign_typed_data`) require `enableUnsafeRawSign: true` in config.

See the [OpenClaw plugin package](packages/openclaw-plugin/) for configuration details.

## Supported Protocols

| Protocol | Actions | Decoder | Policy Evaluator |
|----------|---------|:---:|:---:|
| ERC-20 | `approve`, `transfer` | Yes | Yes (allowance cap, spender allowlist) |
| Uniswap V3 | `exactInputSingle` | Yes | Yes (token pair, slippage, recipient) |
| Aave V3 | `supply`, `borrow`, `repay`, `withdraw` | Yes | Yes (asset allowlist, interest rate mode) |

Unknown calldata is always rejected (fail-closed). The dispatcher uses 2-stage resolution: contract address first, then selector-based fallback (e.g., ERC-20).

## Configuration

### Policy Config

The policy engine uses a JSON configuration file. Without a policy file, all policy-guarded signing operations (DeFi calls, swaps, permits) are denied. Non-signing tools (`get_address`, `health_check`) and raw signing tools (when opt-in via `--unsafe-raw-sign`) are unaffected by the policy file.

See [`policy.example.json`](policy.example.json) for a complete example.

```json
{
  "allowedChainIds": [1, 11155111],
  "allowedContracts": [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"
  ],
  "allowedSelectors": [
    "0x095ea7b3", "0xa9059cbb", "0x04e45aaf",
    "0x617ba037", "0xa415bcad", "0x573ade81", "0x69328dec"
  ],
  "maxAmountWei": "1000000000000000000",
  "maxDeadlineSeconds": 1800,
  "protocolPolicies": {
    "erc20": {
      "maxAllowanceWei": "1000000000000000000",
      "tokenAllowlist": ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]
    },
    "uniswap_v3": {
      "maxSlippageBps": 100,
      "tokenAllowlist": ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
      "recipientAllowlist": []
    },
    "aave_v3": {
      "tokenAllowlist": ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"],
      "maxInterestRateMode": 2,
      "maxAmountWei": "1000000000000000000"
    }
  }
}
```

### Base Policy Fields

| Field | Type | Description |
|-------|------|-------------|
| `allowedChainIds` | `number[]` | Allowed chain IDs |
| `allowedContracts` | `string[]` | Allowed contract addresses (case-insensitive) |
| `allowedSelectors` | `string[]` | Allowed 4-byte function selectors |
| `maxAmountWei` | `string` | Maximum transaction value in wei |
| `maxDeadlineSeconds` | `number` | Maximum deadline as seconds from now |

### Protocol Policy Fields (`protocolPolicies`)

| Field | Protocols | Description |
|-------|-----------|-------------|
| `tokenAllowlist` | all | Allowed token contract addresses |
| `recipientAllowlist` | erc20, uniswap_v3, aave_v3 | Allowed spender (approve) / recipient (transfer) addresses |
| `maxAllowanceWei` | erc20 | Maximum ERC-20 approval amount |
| `maxSlippageBps` | uniswap_v3 | Maximum slippage in basis points |
| `maxInterestRateMode` | aave_v3 | Maximum Aave interest rate mode (1=stable, 2=variable) |
| `maxAmountWei` | aave_v3 | Maximum Aave operation amount |

## Security Model

### Trust Boundary

```
 AI Agent (Claude / MCP Client / OpenClaw)
          |
          | MCP Protocol / OpenClaw Plugin API
          v
 +------------------------------------+
 |   Agentic Vault                    |
 |  +-----------+ +--------+ +-----+ |
 |  | Protocol  | | Policy | | Audit| |
 |  | Dispatcher| | Engine | | Sink | |
 |  +-----------+ +--------+ +-----+ |
 |          |                         |
 |  +--------------------+           |
 |  | EvmSignerAdapter   |           |
 |  +--------------------+           |
 +-----------|------------------------+
             | digest only
             v
 +------------------------------------+
 |       AWS KMS (HSM)                |
 |   Private key never leaves         |
 +------------------------------------+
```

### Key Principles

| Principle | Description |
|-----------|-------------|
| Key isolation | Private keys remain in the HSM; only 32-byte digests are sent for signing |
| Deny by default | Policy engine rejects all requests unless explicitly allowed |
| Fail-closed | Unknown calldata is always rejected; known protocol without evaluator is rejected |
| Audit trail | Every operation is logged as structured JSON to stderr with caller tag |
| Minimal surface | Raw signing tools (`sign_transaction`, `sign_typed_data`) are disabled by default |

## Claude Code Plugin

The project includes 4 Claude Code skills that interact with the wallet through MCP tools only -- they never access keys directly.

| Skill | Description |
|-------|-------------|
| `sign-swap` | Orchestrate a swap signing operation |
| `sign-permit` | Orchestrate an EIP-2612 permit signing |
| `check-wallet` | Check wallet address and health status |
| `audit-log` | Query the audit log |

## Package Exports

| Subpath | Contents | MCP dependency |
|---------|----------|:-:|
| `@agenticvault/agentic-vault` | Core signing (SigningProvider, EvmSignerAdapter, factory) | No |
| `@agenticvault/agentic-vault/protocols` | Protocol decoders, dispatcher, PolicyEngine V2, workflows | No |
| `@agenticvault/agentic-vault/agentic` | MCP server, audit logger | Yes |

## AWS KMS Setup

### Key Creation

```bash
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "Agentic Vault EVM signing key"
```

### IAM Policy

Minimum required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["kms:Sign", "kms:GetPublicKey", "kms:DescribeKey"],
      "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
    }
  ]
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Write tests for your changes
4. Ensure all checks pass:
   ```bash
   pnpm lint:fix && pnpm typecheck && pnpm test:unit
   ```
5. Commit your changes (`git commit -m 'feat: add my feature'`)
6. Push to the branch (`git push origin feat/my-feature`)
7. Open a Pull Request

### Branch Naming

| Prefix | Use |
|--------|-----|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation |
| `refactor/` | Code refactoring |

### Commit Message Format

```
<type>: <subject>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## License

[MIT](LICENSE)
