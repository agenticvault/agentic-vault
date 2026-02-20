---
name: agentic-vault-setup-guide
description: >
  Comprehensive installation guide for Agentic Vault with AWS KMS on non-AWS VMs.
  Covers the full setup scope: AWS KMS key creation, private CA + client certificates,
  IAM Roles Anywhere configuration, VM tooling (AWS CLI, signing helper), OpenClaw
  plugin installation, plugin configuration, policy setup, and systemd service integration.
  Use this skill whenever a user mentions installing Agentic Vault, setting up a vault,
  deploying to a VM, configuring AWS KMS signing, or connecting Agentic Vault to OpenClaw.
  Also trigger when users ask about certificate setup, IAM Roles Anywhere, or
  vault credential issues on non-AWS machines.
---

# Agentic Vault Setup Guide

Guide users through deploying Agentic Vault on a non-AWS VM using IAM Roles Anywhere for zero long-lived credentials.

## Architecture Overview

```
Dev Machine (has AWS access)          VM (production, no AWS credentials)
─────────────────────────────         ────────────────────────────────────
1. Create KMS key (secp256k1)         6. Install AWS CLI + signing helper
2. Create CA + client cert            7. Deploy client cert
3. Store CA key securely              8. Write AWS config profile
4. Create Trust Anchor + Role         9. Install OpenClaw plugin
5. Transfer cert to VM               10. Configure plugin + policy
                                     11. (Optional) systemd gateway env
```

Auth flow (zero long-lived credentials):

```
VM → aws_signing_helper → IAM Roles Anywhere → STS → temp credentials (1h) → KMS:Sign
```

## Decision Tree

Before starting, determine which phases the user needs:

```
Has AWS KMS key?
├─ No  → Start at Phase 1 (read references/aws-dev-setup.md)
└─ Yes
   Has client certificate?
   ├─ No  → Start at Phase 1, Step 2
   └─ Yes
      Has IAM Roles Anywhere configured?
      ├─ No  → Start at Phase 1, Step 4
      └─ Yes
         VM tools installed?
         ├─ No  → Start at Phase 2 (read references/vm-setup.md)
         └─ Yes
            OpenClaw plugin configured?
            ├─ No  → Start at Phase 3 (read references/openclaw-config.md)
            └─ Yes → Verify setup (see Verification below)
```

## Phases

### Phase 1: AWS Setup (Dev Machine)

Read `references/aws-dev-setup.md` for complete instructions.

| Step | What | Verification |
|------|------|-------------|
| 1 | Create KMS key (ECC_SECG_P256K1) | `aws kms describe-key --key-id KEY_ID` returns `Enabled` |
| 2 | Create self-signed CA + client cert | `openssl verify -CAfile ca.pem client.crt` succeeds |
| 3 | Store CA key securely (1Password / USB) | `ca.key` removed from disk |
| 4 | Create Trust Anchor, IAM Role, Profile | All three enabled + correct ARNs |
| 5 | Transfer client cert+key to VM via scp | Files exist in `/tmp/` on VM |

Common gotchas in this phase:
- CA cert **must** have `basicConstraints=critical,CA:TRUE` or Trust Anchor creation fails
- Client cert **must** have `keyUsage: digitalSignature` + `extendedKeyUsage: clientAuth`
- Never transfer `ca.key` to the VM

### Phase 2: VM Setup

Read `references/vm-setup.md` for complete instructions.

Alternatively, if the user prefers an automated approach, the project provides a one-command setup script:

```bash
export TRUST_ANCHOR_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/ID"
export PROFILE_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:profile/ID"
export ROLE_ARN="arn:aws:iam::ACCOUNT:role/ROLE_NAME"
export AWS_REGION="ap-northeast-1"
bash scripts/vm-setup.sh
```

Manual steps overview:

| Step | What | Verification |
|------|------|-------------|
| 6 | Install AWS CLI v2 | `aws --version` |
| 7 | Install aws_signing_helper | `aws_signing_helper --version` |
| 8 | Deploy client cert to `/etc/pki/rolesanywhere/` | `ls -la /etc/pki/rolesanywhere/` |
| 9 | Write `~/.aws/config` profile | `cat ~/.aws/config` shows profile |
| 10 | Verify credentials | `AWS_PROFILE=rolesanywhere-kms aws sts get-caller-identity` |

Key points:
- Signing helper URL is **case-sensitive** (`Aarch64` not `AARCH64`)
- `credential_process` must be a **single line** in `~/.aws/config`
- Client key needs `chmod 440` + `chown root:<app-group>`

### Phase 3: OpenClaw Plugin + Policy

Read `references/openclaw-config.md` for complete instructions.

| Step | What | Verification |
|------|------|-------------|
| 11 | Install plugin | `openclaw plugins list` shows `agentic-vault-openclaw` |
| 12 | Configure plugin in OpenClaw config | Plugin loads without errors |
| 13 | Create policy.json | `vault_get_address` returns address |
| 14 | (Optional) systemd gateway env | `systemctl --user show openclaw-gateway -p Environment` has AWS vars |

## Full Verification Checklist

After completing all phases, verify end-to-end:

```bash
# 1. Credentials work
AWS_PROFILE=rolesanywhere-kms aws sts get-caller-identity

# 2. KMS key accessible
AWS_PROFILE=rolesanywhere-kms aws kms get-public-key \
  --key-id alias/agentic-vault-signer --region REGION

# 3. OpenClaw plugin loaded
openclaw plugins list

# 4. Vault tools functional (via OpenClaw agent)
# Use vault_get_address tool — should return 0x... address
# Use vault_health_check tool — should return healthy status
```

## Troubleshooting

Read `references/troubleshooting.md` for a complete troubleshooting guide covering:

- Certificate issues (missing extensions, permissions, expiry)
- Roles Anywhere errors (disabled anchor/profile, access denied)
- Signing helper problems (wrong arch, XML download, config parsing)
- OpenClaw gateway systemd env var issues
- Common chain ID mismatches

## Quick Reference: Collected ARNs

Users need these ARNs across multiple steps. Suggest they record them early:

| ARN | Where Created | Where Used |
|-----|--------------|------------|
| KMS Key ARN | Step 1 | IAM policy (Step 4c), plugin config (Step 12) |
| Trust Anchor ARN | Step 4a | IAM trust policy (Step 4b), AWS config (Step 9) |
| Profile ARN | Step 4d | AWS config (Step 9) |
| Role ARN | Step 4b | Roles Anywhere Profile (Step 4d), AWS config (Step 9) |

## Annual Maintenance

Client certificates expire after 1 year. Read `references/aws-dev-setup.md` "Cert Renewal" section for the renewal procedure. Key points:
- Retrieve CA key from secure storage
- Sign new client cert with same extensions
- Transfer to VM, replace old cert, restart services
- Re-secure CA key
