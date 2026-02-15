# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-02-13

### Added

#### Core Signing (Phase 1)
- Provider abstraction layer (SigningProvider, EvmSignerAdapter, factory)
- AWS KMS provider (AwsKmsProvider) with DER signature parsing and low-s normalization
- Policy engine with chainId/contract/selector/amount/deadline validation
- Structured audit logging (JSON to stderr)
- CI/CD pipelines (GitHub Actions)
- Sepolia testnet broadcast integration tests

#### Protocol Decoder Framework (Phase 2)
- ERC-20 calldata decoder (approve, transfer)
- ProtocolDispatcher with 2-stage resolution (contract address, then selector fallback)
- Selector registry for 4-byte function signature matching

#### Policy V2 (Phase 3)
- ProtocolPolicyEvaluator interface for protocol-specific policy rules
- ERC-20 evaluator (allowance cap, spender allowlist)
- Uniswap V3 evaluator (token pair, slippage, recipient constraints)

#### Aave V3 Support (Phase 4)
- Aave V3 calldata decoder (supply, borrow, repay, withdraw)
- Aave V3 policy evaluator (asset allowlist, interest rate mode, amount limits)

#### Security Hardening (Phase 5)
- ESLint trust boundary enforcement for `src/agentic/` (no direct internal imports)
- Fail-closed behavior for unknown calldata
- Trust boundary integration tests

#### Multi-Interface Architecture (Phase 6)
- Workflow layer (`signDefiCall`, `signPermit`, `getAddressWorkflow`, `healthCheckWorkflow`)
- CLI with 8 subcommands (sign, sign-permit, dry-run, encode, decode, get-address, health, mcp)
- MCP server refactored to use workflow layer
- `sign_defi_call` MCP tool as generalized DeFi signing endpoint (alongside `sign_swap`)

#### CLI UX (Phase 7)
- Environment variable fallback (`VAULT_KEY_ID`, `VAULT_REGION`)
- Output format options (`--output json|human|raw`)
- Dry-run mode (decode + policy check without signing)
- Encode command (intent parameters to calldata hex)
- Decode command (calldata hex to intent JSON)

#### OpenClaw Plugin (Phase 8)
- `@agenticvault/openclaw` package
- 4 safe tools: `vault_get_address`, `vault_health_check`, `vault_sign_defi_call`, `vault_sign_permit`
- 2 dual-gated tools: `vault_sign_transaction`, `vault_sign_typed_data` (requires `enableUnsafeRawSign`)
- Claude Code plugin manifest (`.claude-plugin/plugin.json`) with 4 skills
