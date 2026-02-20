# Phase 2: VM Setup

All steps run on the target Ubuntu/Debian VM. Requires sudo access and Node.js 22+.

## Prerequisites

| Requirement | Check |
|-------------|-------|
| Ubuntu/Debian VM | `cat /etc/os-release` |
| sudo access | `sudo -v` |
| Node.js 22+ | `node --version` |
| Client cert + key in `/tmp/` | `ls /tmp/client.crt /tmp/client.key` |
| ARNs from Phase 1 | Trust Anchor, Profile, Role ARNs |

If Node.js is not installed:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

## Automated Setup (Recommended)

The project provides `scripts/vm-setup.sh` that automates Steps 6-10:

```bash
export TRUST_ANCHOR_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/ID"
export PROFILE_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:profile/ID"
export ROLE_ARN="arn:aws:iam::ACCOUNT:role/ROLE_NAME"
export AWS_REGION="ap-northeast-1"
bash scripts/vm-setup.sh
```

Optional env vars: `SKIP_AWS_CLI=1`, `SKIP_OPENCLAW=1`, `SKIP_SYSTEMD=1`, `SIGNING_HELPER_VER=1.7.3`.

If using the automated script, skip to Phase 3 after it completes.

## Manual Steps

### Step 6: Install AWS CLI v2

```bash
ARCH=$(uname -m)  # aarch64 or x86_64
if [ "$ARCH" = "aarch64" ]; then CLI_ARCH="aarch64"; else CLI_ARCH="x86_64"; fi

sudo apt install -y unzip
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${CLI_ARCH}.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp/
sudo /tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws
```

**Verify**: `aws --version`

### Step 7: Install aws_signing_helper

The URL path is **case-sensitive**. Use the exact casing below.

```bash
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
  HELPER_URL="https://rolesanywhere.amazonaws.com/releases/1.7.3/Aarch64/Linux/Amzn2023/aws_signing_helper"
else
  HELPER_URL="https://rolesanywhere.amazonaws.com/releases/1.7.3/X86_64/Linux/Amzn2023/aws_signing_helper"
fi

curl -Lo /tmp/aws_signing_helper "$HELPER_URL"

# Verify it's a binary (not an XML error page)
file /tmp/aws_signing_helper | grep -q "ELF" || echo "ERROR: not a binary, check URL"

sudo install -m 755 /tmp/aws_signing_helper /usr/local/bin/
rm /tmp/aws_signing_helper
```

**Verify**: `aws_signing_helper version` or `which aws_signing_helper`

### Step 8: Deploy Client Certificate

Move certs from `/tmp/` to a secure permanent location immediately.

```bash
sudo mkdir -p /etc/pki/rolesanywhere
sudo install -m 444 /tmp/client.crt /etc/pki/rolesanywhere/client.crt
sudo install -m 440 /tmp/client.key /etc/pki/rolesanywhere/client.key
sudo chown root:$(id -gn) /etc/pki/rolesanywhere/client.key
rm /tmp/client.crt /tmp/client.key
```

**Verify**: `ls -la /etc/pki/rolesanywhere/` — key should be `440` owned by `root:<your-group>`.

### Step 9: Write AWS Config Profile

The `credential_process` line must be a single line (no backslash continuations).

```bash
# Replace placeholders with actual ARNs from Phase 1
TA_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/TA_ID"
PROFILE_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:profile/PROFILE_ID"
ROLE_ARN="arn:aws:iam::ACCOUNT:role/agentic-vault-signer"

mkdir -p ~/.aws
cat >> ~/.aws/config << EOF

[profile rolesanywhere-kms]
region = REGION
credential_process = /usr/local/bin/aws_signing_helper credential-process --certificate /etc/pki/rolesanywhere/client.crt --private-key /etc/pki/rolesanywhere/client.key --trust-anchor-arn ${TA_ARN} --profile-arn ${PROFILE_ARN} --role-arn ${ROLE_ARN}
EOF
```

### Step 10: Verify Credentials

```bash
AWS_PROFILE=rolesanywhere-kms aws sts get-caller-identity
```

Expected output:

```json
{
    "UserId": "AROA...:...",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/agentic-vault-signer/..."
}
```

If this fails, check the troubleshooting guide (`references/troubleshooting.md`).

## Quick Test: MCP Server Standalone

Before integrating with OpenClaw, verify the MCP server works standalone:

```bash
AWS_PROFILE=rolesanywhere-kms agentic-vault-mcp \
  --key-id alias/agentic-vault-signer \
  --region REGION
```

This starts the MCP server on stdio. If it launches without error, credentials + KMS access are working.
