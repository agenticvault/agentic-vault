# Agentic Vault

[![npm version](https://img.shields.io/npm/v/@agenticvault/agentic-vault)](https://www.npmjs.com/package/@agenticvault/agentic-vault)
[![CI](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

Server-side EVM signing with AWS KMS and built-in DeFi protocol awareness. Expose your wallet to AI agents via MCP, CLI, or OpenClaw with deny-by-default policy enforcement and full audit logging.

## Why Agentic Vault

AI agents need to sign blockchain transactions, but giving them private keys is dangerous. Agentic Vault solves this by keeping keys in AWS KMS (HSM) and providing a policy engine that constrains what agents can sign. The agent sees high-level tools (`sign_swap`, `sign_permit`); the private key never leaves the hardware.

## Features

- **HSM-backed signing** -- private keys never leave AWS KMS; only digests are sent for signing
- **DeFi protocol awareness** -- calldata decoding for ERC-20, Uniswap V3, and Aave V3 with protocol-specific policy rules
- **Deny-by-default policy engine** -- chain, contract, selector, amount, deadline, and protocol-level constraints
- **Multiple interfaces** -- use as a TypeScript library, CLI, MCP server, or OpenClaw plugin
- **Audit logging** -- structured JSON audit trail for every signing operation (approved, denied, errored)
- **EVM-native** -- built on [viem](https://viem.sh) with full EIP-712 typed data support

## Quick Start

```bash
npm install @agenticvault/agentic-vault
```

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

For a no-AWS quick test, use `dry-run` mode (decode + policy check without signing):

```bash
npx agentic-vault dry-run --chain-id 1 --to 0xa0b869... --data 0x095ea7b3...
```

See [AWS KMS Setup](docs/guides/aws-kms-setup.md) for key creation and IAM policy.

## Interfaces

| Interface | Use Case | AWS Required |
|-----------|----------|:---:|
| TypeScript Library | Embed signing in your app | Yes |
| CLI | Command-line signing + dry-run | Partial |
| MCP Server | Expose wallet to AI agents (Claude, etc.) | Yes |
| OpenClaw Plugin | Use as OpenClaw agent tool | Yes |

See [Interfaces Guide](docs/guides/interfaces.md) for usage examples and configuration.

## Supported Protocols

| Protocol | Actions | Decoder | Policy Evaluator |
|----------|---------|:---:|:---:|
| ERC-20 | `approve`, `transfer` | Yes | Yes (allowance cap, spender allowlist) |
| Uniswap V3 | `exactInputSingle` | Yes | Yes (token pair, slippage, recipient) |
| Aave V3 | `supply`, `borrow`, `repay`, `withdraw` | Yes | Yes (asset allowlist, interest rate mode) |

Unknown calldata is always rejected (fail-closed). The dispatcher uses 2-stage resolution: contract address first, then selector-based fallback (e.g., ERC-20).

## Configuration

The policy engine uses a JSON configuration file. Without a policy file, all policy-guarded signing operations are denied (deny-by-default).

See [Policy Reference](docs/reference/policy.md) for the full schema and examples, or start with [`policy.example.json`](policy.example.json).

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

4 skills interact with the wallet through MCP tools only -- they never access keys directly.

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

## Documentation

| Document | Description |
|----------|-------------|
| [Interfaces Guide](docs/guides/interfaces.md) | TypeScript, CLI, MCP, and OpenClaw usage |
| [Policy Reference](docs/reference/policy.md) | Policy JSON schema, fields, and examples |
| [AWS KMS Setup](docs/guides/aws-kms-setup.md) | Key creation, IAM policy, authentication |
| [OpenClaw Plugin](packages/openclaw-plugin/) | OpenClaw plugin package and configuration |
| [Architecture Decisions](docs/project/adrs/ADR-001-architecture-decisions.md) | ADRs for key design choices |
| [Contributing](CONTRIBUTING.md) | Development workflow and guidelines |

## Roadmap

- Additional signing providers (GCP KMS, HashiCorp Vault)
- More protocol decoders (Curve, Compound V3)
- Multi-signature support
- Remote MCP server mode (HTTP transport with OAuth 2.1)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, branch naming, and commit conventions.

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
