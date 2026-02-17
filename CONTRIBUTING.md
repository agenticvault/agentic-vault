# Contributing to Agentic Vault

Thank you for your interest in contributing. This guide covers development setup, project conventions, and the review process.

## Development Setup

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- AWS credentials (for integration/e2e tests only)

### Getting Started

```bash
git clone https://github.com/agenticvault/agentic-vault.git
cd agentic-vault-wallet
pnpm install
pnpm build
pnpm test:unit
```

## Project Structure

```
src/
  provider/        # SigningProvider abstraction and factory
  providers/       # Provider implementations (aws-kms/)
  core/            # Shared types and utilities
  protocols/       # Protocol decoders, policy engine, workflows
    decoders/      # Calldata decoders (ERC-20, Uniswap V3, Aave V3)
    policy/        # Policy engine and protocol-specific evaluators
    workflows/     # High-level signing workflows
  agentic/         # MCP server (trust boundary — restricted imports via ESLint)
  cli/             # CLI commands
packages/
  openclaw-plugin/ # OpenClaw plugin package
test/
  unit/            # Unit tests (mirror src/ structure)
  integration/     # Integration tests (external mocks only)
  e2e/             # End-to-end tests (no mocks)
```

## Testing

| Type | Directory | Mocking | Run |
|------|-----------|---------|-----|
| Unit | `test/unit/` | Allowed | `pnpm test:unit` |
| Integration | `test/integration/` | External services only | `pnpm test:integration` |
| E2E | `test/e2e/` | None | `pnpm test:e2e` |

### When Tests Are Required

| Change | Required Tests |
|--------|---------------|
| New service/provider | Unit tests in `test/unit/` |
| Modified logic | Existing tests pass + new test cases |
| Bug fix | Regression test |
| New MCP tool | Unit test in `test/unit/agentic/mcp/tools/` |

### Coverage Expectations

Each test should cover: happy path, error handling, and edge cases (null, empty, boundary values).

## Code Style

- **TypeScript** with strict mode
- **ESLint** for linting (`pnpm lint:fix`)
- **viem** for all EVM operations
- Match the style of surrounding code -- find similar files first

## Pre-Submit Checklist

Before opening a PR, ensure all checks pass:

```bash
pnpm lint:fix
pnpm typecheck
pnpm test:unit
```

## Branch Naming

| Prefix | Use |
|--------|-----|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation |
| `refactor/` | Code refactoring |

## Commit Message Format

```
<type>: <subject>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Security Considerations

### Trust Boundary

`src/agentic/` is the trust boundary between AI agents and the signing core. Code in this directory:

- Can only import from barrel exports (`../../index.js`, `../../protocols/index.js`) and external packages
- Must not import internal modules directly (e.g., no importing from `../../providers/aws-kms/`)
- Is enforced by ESLint rules

### Policy Engine

All policy-guarded signing flows must go through the PolicyEngine. Unknown calldata is always rejected (fail-closed). If you're adding a new protocol decoder, you must also add a corresponding policy evaluator.

## Vulnerability Reporting

For security vulnerabilities, see [SECURITY.md](SECURITY.md). Do not open public issues for security bugs.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code. Report sensitive conduct issues via [GitHub private reporting](https://github.com/agenticvault/agentic-vault/security/advisories/new); for non-sensitive matters, open an issue with the `conduct` label.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
