# Agentic Vault Wallet

[![npm version](https://img.shields.io/npm/v/@sd0xdev/agentic-vault)](https://www.npmjs.com/package/@sd0xdev/agentic-vault)
[![CI](https://github.com/sd0xdev/agentic-vault-wallet/actions/workflows/ci.yml/badge.svg)](https://github.com/sd0xdev/agentic-vault-wallet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Server-side EVM signing with pluggable providers and agentic capabilities. Expose your wallet to AI agents via MCP (Model Context Protocol) with built-in policy enforcement and audit logging.

## Features

- **Pluggable signing providers** -- factory-based architecture, currently supports AWS KMS (more coming)
- **MCP server** -- expose wallet operations as MCP tools for AI agents
- **Policy engine** -- deny-by-default policy with chain, contract, selector, amount, and deadline constraints
- **Audit logging** -- structured JSON audit trail for every signing operation
- **Claude Code plugin** -- 4 built-in skills for interacting with the wallet from Claude Code
- **EVM-native** -- built on [viem](https://viem.sh) with full EIP-712 typed data support
- **Key isolation** -- private keys never leave the HSM; only digests are sent for signing

## Quick Start

### Install

```bash
npm install @sd0xdev/agentic-vault
# or
pnpm add @sd0xdev/agentic-vault
```

> Requires Node.js >= 22

### Basic Usage

```typescript
import {
  createSigningProvider,
  EvmSignerAdapter,
} from '@sd0xdev/agentic-vault';

// Create a signing provider via factory
const provider = createSigningProvider({
  provider: 'aws-kms',
  keyId: 'arn:aws:kms:us-east-1:123456789:key/your-key-id',
  region: 'us-east-1',
});

// Wrap it in an EVM signer adapter
const signer = new EvmSignerAdapter(provider, {
  expectedAddress: '0xYourExpectedAddress',
});

// Use it
const address = await signer.getAddress();
const signedTx = await signer.signTransaction({
  chainId: 1,
  to: '0xContractAddress',
  data: '0x...',
  value: 0n,
});
```

## MCP Server

The MCP server exposes wallet operations as tools that AI agents can call over stdio.

### Running the Server

```bash
npx agentic-vault-mcp \
  --key-id arn:aws:kms:us-east-1:123456789:key/your-key-id \
  --region us-east-1 \
  --expected-address 0xYourAddress \
  --policy-config ./policy.json
```

### CLI Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--key-id <KEY_ID>` | Yes | AWS KMS key ARN or alias |
| `--region <REGION>` | Yes | AWS region |
| `--expected-address <ADDR>` | No | Verify derived address matches expected |
| `--unsafe-raw-sign` | No | Enable `sign_transaction` and `sign_typed_data` tools |
| `--policy-config <PATH>` | No | Path to policy configuration JSON file |

### MCP Tools

| Tool | Description | Default |
|------|-------------|---------|
| `get_address` | Get the wallet's Ethereum address | Enabled |
| `health_check` | Verify KMS key configuration and connectivity | Enabled |
| `sign_swap` | Sign a swap transaction (policy-constrained) | Enabled |
| `sign_permit` | Sign an EIP-2612 permit (policy-constrained) | Enabled |
| `sign_transaction` | Raw transaction signing | Disabled (requires `--unsafe-raw-sign`) |
| `sign_typed_data` | Raw EIP-712 typed data signing | Disabled (requires `--unsafe-raw-sign`) |

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentic-vault": {
      "command": "npx",
      "args": [
        "agentic-vault-mcp",
        "--key-id", "arn:aws:kms:us-east-1:123456789:key/your-key-id",
        "--region", "us-east-1",
        "--policy-config", "/path/to/policy.json"
      ],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret-key"
      }
    }
  }
}
```

## Claude Code Plugin

The project includes 4 Claude Code skills that interact with the wallet through MCP tools only -- they never access keys directly.

| Skill | Description |
|-------|-------------|
| `sign-swap` | Orchestrate a swap signing operation |
| `sign-permit` | Orchestrate an EIP-2612 permit signing |
| `check-wallet` | Check wallet address and health status |
| `audit-log` | Query the audit log |

## Security Model

### Trust Boundary

```
 AI Agent (Claude / MCP Client)
          |
          | MCP Protocol (stdio)
          v
 +-----------------------------+
 |   Agentic Vault MCP Server  |
 |  +----------+ +-----------+ |
 |  |  Policy   | |   Audit   | |
 |  |  Engine   | |   Logger  | |
 |  +----------+ +-----------+ |
 |          |                   |
 |  +--------------------+     |
 |  | EvmSignerAdapter   |     |
 |  +--------------------+     |
 +-----------|------------------+
             | digest only
             v
 +-----------------------------+
 |       AWS KMS (HSM)         |
 |   Private key never leaves  |
 +-----------------------------+
```

### Key Principles

| Principle | Description |
|-----------|-------------|
| Key isolation | Private keys remain in the HSM; only 32-byte digests are sent for signing |
| Deny by default | Policy engine rejects all requests unless explicitly allowed |
| Audit trail | Every operation (approved, denied, errored) is logged as structured JSON to stderr |
| Minimal surface | Raw signing tools (`sign_transaction`, `sign_typed_data`) are disabled by default |
| Address verification | Optional `--expected-address` flag catches key misconfiguration at startup |

## API Reference

### Interfaces

```typescript
// src/types.ts -- High-level signer interface
interface SignerAdapter {
  getAddress(): Promise<`0x${string}`>;
  signTransaction(tx: TransactionSerializable): Promise<`0x${string}`>;
  signTypedData(params: SignTypedDataParams): Promise<SignatureComponents>;
  healthCheck(): Promise<void>;
}

// src/core/signing-provider.ts -- Low-level provider interface
interface SigningProvider {
  signDigest(digest: Uint8Array): Promise<SignatureBlob>;
  getPublicKey(): Promise<PublicKeyBlob>;
  healthCheck(): Promise<void>;
}
```

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `createSigningProvider` | Function | Factory to create a `SigningProvider` from config |
| `EvmSignerAdapter` | Class | Provider-agnostic EVM signer implementing `SignerAdapter` |
| `AwsKmsProvider` | Class | AWS KMS implementation of `SigningProvider` |
| `AwsKmsClient` | Class | AWS KMS client wrapper |
| `KmsSignerAdapter` | Class | Legacy signer adapter (backward compatibility) |
| `PolicyEngine` | Class | Policy evaluation engine |
| `AuditLogger` | Class | Structured JSON audit logger |
| `createMcpServer` | Function | Create an MCP server instance |
| `startStdioServer` | Function | Create and start an MCP server over stdio |
| `parseDerSignature` | Function | Parse DER-encoded ECDSA signature |
| `normalizeSignature` | Function | Normalize signature to low-s form |
| `resolveRecoveryParam` | Function | Resolve ECDSA recovery parameter |
| `publicToAddress` | Function | Derive Ethereum address from public key |

### Type Exports

| Type | Source |
|------|--------|
| `SignerAdapter`, `SignatureComponents`, `SignTypedDataParams` | `src/types.ts` |
| `SigningProvider`, `SignatureBlob`, `PublicKeyBlob` | `src/core/signing-provider.ts` |
| `SigningProviderConfig`, `AwsKmsSigningProviderConfig` | `src/provider/factory.ts` |
| `PolicyConfig`, `PolicyRequest`, `PolicyEvaluation` | `src/agentic/policy/types.ts` |
| `AuditEntry` | `src/agentic/audit/types.ts` |
| `EvmSignerAdapterConfig` | `src/core/evm-signer-adapter.ts` |
| `KmsSignerConfig` | `src/kms-signer.ts` |
| `IKmsClient`, `KmsKeyMetadata` | `src/kms-client.ts` |

## Providers

### AWS KMS

#### Key Creation

Create an ECC_SECG_P256K1 (secp256k1) key in AWS KMS:

```bash
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "Agentic Vault EVM signing key"
```

#### IAM Policy

Minimum required permissions for the signing service:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
    }
  ]
}
```

#### Provider Config

```typescript
import { createSigningProvider } from '@sd0xdev/agentic-vault';

const provider = createSigningProvider({
  provider: 'aws-kms',
  keyId: 'arn:aws:kms:us-east-1:123456789:key/your-key-id',
  region: 'us-east-1',
});
```

## Configuration

### Policy Config

The policy engine uses a JSON configuration file to define allowed operations. All fields are required; leave arrays empty and numeric fields at `0` to deny all.

```json
{
  "allowedChainIds": [1, 137, 42161],
  "allowedContracts": [
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"
  ],
  "allowedSelectors": [
    "0x5ae401dc"
  ],
  "maxAmountWei": "1000000000000000000",
  "maxDeadlineSeconds": 300
}
```

### Policy Fields

| Field | Type | Description |
|-------|------|-------------|
| `allowedChainIds` | `number[]` | Whitelist of allowed chain IDs |
| `allowedContracts` | `string[]` | Whitelist of allowed contract addresses (case-insensitive) |
| `allowedSelectors` | `string[]` | Whitelist of allowed 4-byte function selectors |
| `maxAmountWei` | `string` | Maximum transaction value in wei (as decimal string in JSON, `bigint` internally) |
| `maxDeadlineSeconds` | `number` | Maximum allowed deadline as seconds from now |

### Policy Behavior

| Rule | Description |
|------|-------------|
| Deny by default | Requests are denied unless all applicable checks pass |
| Chain ID check | `chainId` must be in `allowedChainIds` |
| Contract check | `to` address must be in `allowedContracts` |
| Selector check | Function selector (first 4 bytes of calldata) must be in `allowedSelectors` |
| Amount check | Transaction value must not exceed `maxAmountWei` |
| Deadline check | Deadline must be in the future and within `maxDeadlineSeconds` from now |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Write tests for your changes
4. Ensure all checks pass:
   ```bash
   pnpm lint:fix && pnpm typecheck && pnpm test
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
