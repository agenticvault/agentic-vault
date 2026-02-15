# Security Policy

## Supported Versions

| Version | Supported |
|---------|:---------:|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

### Preferred: GitHub Private Vulnerability Reporting

1. Go to the [Security Advisories](https://github.com/agenticvault/agentic-vault/security/advisories) page
2. Click "Report a vulnerability"
3. Fill in the details

### Alternative: Email

Send an email to **security@agenticvault.dev** with:

- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Impact assessment

### Response SLA

| Stage | Timeline |
|-------|----------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix (Critical/High) | Within 14 days |
| Fix (Medium/Low) | Within 30 days |

## Severity Definitions

| Severity | Description |
|----------|-------------|
| **Critical** | Remote code execution, private key exposure, policy engine bypass allowing unauthorized signing |
| **High** | Denial of service on signing operations, audit log tampering, authentication bypass |
| **Medium** | Information disclosure (non-key material), policy evaluation edge cases |
| **Low** | Minor issues with no direct security impact |

## Scope

### In Scope

- Signing logic (`src/provider/`, `src/providers/aws-kms/`, `EvmSignerAdapter`)
- Policy engine (`src/protocols/policy/`)
- Protocol decoders (`src/protocols/decoders/`)
- MCP server tool handlers (`src/agentic/`)
- OpenClaw plugin tool registration (`packages/openclaw-plugin/`)
- Trust boundary enforcement between agentic and core layers
- DER signature parsing, low-s normalization, recovery parameter handling

### Out of Scope

- AWS KMS service availability or HSM security (covered by AWS shared responsibility model)
- Vulnerabilities in upstream dependencies (report to the respective project)
- Social engineering attacks
- Issues requiring physical access to the host machine

## Credit

We credit reporters in the release notes (with permission). If you'd like to be credited, include your preferred name and optional link in your report.

## Disclosure Policy

We follow coordinated disclosure. We request that you give us reasonable time to address the vulnerability before public disclosure.
