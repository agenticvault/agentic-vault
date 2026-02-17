# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

#### Transfer & Balance Tools
- `get_balance` MCP tool — query native ETH or ERC20 token balance
- `send_transfer` MCP tool — send native ETH transfer (policy-validated, audit-logged)
- `send_erc20_transfer` MCP tool — send ERC20 token transfer (policy-validated, audit-logged)
- `ViemRpcProvider` (`src/rpc/`) — Viem-based RPC provider with lazy per-chain client caching
- EIP-1559 fee estimation (`estimateFeesPerGas`) with robust fallback to `getGasPrice`
- Chain-aware native currency symbol resolution (ETH, POL, etc.)
- `--rpc-url` CLI flag for MCP server; public RPCs for supported chains (Ethereum, Sepolia, Arbitrum, Base, Polygon)
- `WorkflowRpcProvider` interface for on-chain reads, gas estimation, and tx broadcast
- Integration tests: full pipeline with real PolicyEngine + Dispatcher (15 tests)
- E2E tests: MCP round-trip for balance/transfer tools (9 transfer/balance-focused cases)

#### OpenClaw Plugin
- 3 new safe tools: `vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer`
- `rpcUrl` config option for RPC endpoint override

### Changed
- MCP tool surface expanded from 7 to 10 tools (3 new balance/transfer tools are always registered)
- OpenClaw safe tools expanded from 4 to 7
- Transfer workflows use `estimateFeesPerGas` instead of `getGasPrice * 2n` for EIP-1559 fee calculation

### Migration Notes
- **MCP users**: 3 new tools appear in `listTools`. Without an RPC provider, calling them returns a descriptive error. Existing tools are unaffected.
- **OpenClaw users**: 3 new tools are registered by default. To use balance/transfer tools, add `rpcUrl` to your plugin config. Existing tools work without changes.
- **Library users**: All existing exports are preserved. New exports (`ViemRpcProvider`, `WorkflowRpcProvider`, workflow functions) are additive only.

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
