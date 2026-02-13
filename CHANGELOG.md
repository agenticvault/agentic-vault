# Changelog

## [0.1.0] - 2026-02-13

### Added
- Provider abstraction layer (SigningProvider, EvmSignerAdapter, factory)
- AWS KMS provider (AwsKmsProvider)
- MCP server with policy-constrained tools (sign_swap, sign_permit, get_address, health_check)
- Unsafe raw signing tools (sign_transaction, sign_typed_data) behind --unsafe-raw-sign flag
- Policy engine with chainId/contract/selector/amount/deadline validation
- Structured audit logging (JSON to stderr)
- Claude Code plugin (.claude-plugin + skills)
- ESLint trust boundary enforcement for src/agentic/
- CI/CD pipelines (GitHub Actions)
- Sepolia testnet broadcast integration tests
