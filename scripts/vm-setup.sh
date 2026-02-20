#!/bin/bash
# vm-setup.sh — Set up Agentic Vault on a non-AWS VM with IAM Roles Anywhere
#
# Prerequisites:
#   - Ubuntu/Debian VM with sudo access
#   - Client cert + key already transferred to /tmp/ (via scp)
#   - Node.js 22+ installed
#
# Usage:
#   export TRUST_ANCHOR_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/ID"
#   export PROFILE_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:profile/ID"
#   export ROLE_ARN="arn:aws:iam::ACCOUNT:role/ROLE_NAME"
#   export AWS_REGION="ap-northeast-1"
#   bash scripts/vm-setup.sh
#
# Options (env vars):
#   TRUST_ANCHOR_ARN   (required) IAM Roles Anywhere Trust Anchor ARN
#   PROFILE_ARN        (required) IAM Roles Anywhere Profile ARN
#   ROLE_ARN           (required) IAM Role ARN
#   AWS_REGION         (required) AWS region
#   AWS_PROFILE_NAME   (optional) AWS config profile name      (default: rolesanywhere-kms)
#   CERT_SRC_DIR       (optional) Source dir for client cert/key (default: /tmp)
#   CERT_DEST_DIR      (optional) Destination dir for certs      (default: /etc/pki/rolesanywhere)
#   SIGNING_HELPER_VER (optional) aws_signing_helper version     (default: 1.7.3)
#   SKIP_AWS_CLI       (optional) Set to 1 to skip AWS CLI install
#   SKIP_OPENCLAW      (optional) Set to 1 to skip OpenClaw plugin install
#   SKIP_SYSTEMD       (optional) Set to 1 to skip systemd env setup
#
# Full guide: docs/guides/iam-roles-anywhere-setup.md

set -euo pipefail

# ---------------------------------------------------------------------------
# Guard: must not run as root (breaks ~, id -gn, systemctl --user)
# ---------------------------------------------------------------------------

if [ "$(id -u)" = "0" ]; then
  echo "[fail]  Do not run as root. Run as normal user with sudo privileges." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Required variables
# ---------------------------------------------------------------------------

: "${TRUST_ANCHOR_ARN:?Set TRUST_ANCHOR_ARN}"
: "${PROFILE_ARN:?Set PROFILE_ARN}"
: "${ROLE_ARN:?Set ROLE_ARN}"
: "${AWS_REGION:?Set AWS_REGION}"

# ---------------------------------------------------------------------------
# Optional variables with defaults
# ---------------------------------------------------------------------------

AWS_PROFILE_NAME="${AWS_PROFILE_NAME:-rolesanywhere-kms}"
CERT_SRC_DIR="${CERT_SRC_DIR:-/tmp}"
CERT_DEST_DIR="${CERT_DEST_DIR:-/etc/pki/rolesanywhere}"
SIGNING_HELPER_VER="${SIGNING_HELPER_VER:-1.7.3}"
SKIP_AWS_CLI="${SKIP_AWS_CLI:-0}"
SKIP_OPENCLAW="${SKIP_OPENCLAW:-0}"
SKIP_SYSTEMD="${SKIP_SYSTEMD:-0}"

# ---------------------------------------------------------------------------
# Detect architecture
# ---------------------------------------------------------------------------

ARCH=$(uname -m)

info()  { echo "[info]  $*"; }
ok()    { echo "[ok]    $*"; }
err()   { echo "[fail]  $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Install AWS CLI v2
# ---------------------------------------------------------------------------

if [ "$SKIP_AWS_CLI" = "1" ]; then
  info "Skipping AWS CLI install (SKIP_AWS_CLI=1)"
else
  if command -v aws &>/dev/null; then
    info "AWS CLI already installed: $(aws --version)"
  else
    info "Installing AWS CLI v2..."
    if [ "$ARCH" = "aarch64" ]; then CLI_ARCH="aarch64"; else CLI_ARCH="x86_64"; fi

    sudo apt install -y unzip
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${CLI_ARCH}.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp/
    sudo /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws
    ok "AWS CLI $(aws --version)"
  fi
fi

# ---------------------------------------------------------------------------
# 2. Install aws_signing_helper
# ---------------------------------------------------------------------------

if command -v aws_signing_helper &>/dev/null; then
  info "aws_signing_helper already installed"
else
  info "Installing aws_signing_helper ${SIGNING_HELPER_VER}..."
  if [ "$ARCH" = "aarch64" ]; then
    HELPER_URL="https://rolesanywhere.amazonaws.com/releases/${SIGNING_HELPER_VER}/Aarch64/Linux/Amzn2023/aws_signing_helper"
  else
    HELPER_URL="https://rolesanywhere.amazonaws.com/releases/${SIGNING_HELPER_VER}/X86_64/Linux/Amzn2023/aws_signing_helper"
  fi

  curl -Lo /tmp/aws_signing_helper "$HELPER_URL"
  file /tmp/aws_signing_helper | grep -q "ELF" || err "Downloaded file is not a binary (check URL casing)"
  sudo install -m 755 /tmp/aws_signing_helper /usr/local/bin/
  rm /tmp/aws_signing_helper
  ok "aws_signing_helper installed"
fi

# ---------------------------------------------------------------------------
# 3. Deploy client certificate
# ---------------------------------------------------------------------------

if [ -f "${CERT_DEST_DIR}/client.crt" ] && [ -f "${CERT_DEST_DIR}/client.key" ]; then
  info "Certs already deployed at ${CERT_DEST_DIR}/ — skipping"
else
  info "Deploying client cert from ${CERT_SRC_DIR}..."
  [ -f "${CERT_SRC_DIR}/client.crt" ] || err "Not found: ${CERT_SRC_DIR}/client.crt (scp certs to ${CERT_SRC_DIR}/ first)"
  [ -f "${CERT_SRC_DIR}/client.key" ] || err "Not found: ${CERT_SRC_DIR}/client.key (scp certs to ${CERT_SRC_DIR}/ first)"

  sudo mkdir -p "${CERT_DEST_DIR}"
  sudo install -m 444 "${CERT_SRC_DIR}/client.crt" "${CERT_DEST_DIR}/client.crt"
  sudo install -m 440 "${CERT_SRC_DIR}/client.key" "${CERT_DEST_DIR}/client.key"
  sudo chown "root:$(id -gn)" "${CERT_DEST_DIR}/client.key"
  rm "${CERT_SRC_DIR}/client.crt" "${CERT_SRC_DIR}/client.key"
  ok "Certs deployed to ${CERT_DEST_DIR}/"
fi

# ---------------------------------------------------------------------------
# 4. Write AWS config
# ---------------------------------------------------------------------------

info "Writing AWS config profile [${AWS_PROFILE_NAME}]..."
mkdir -p ~/.aws

# Append if profile doesn't exist, otherwise warn
if grep -qF "[profile ${AWS_PROFILE_NAME}]" ~/.aws/config 2>/dev/null; then
  info "Profile [${AWS_PROFILE_NAME}] already exists in ~/.aws/config — skipping (edit manually if needed)"
else
  cat >> ~/.aws/config << EOF

[profile ${AWS_PROFILE_NAME}]
region = ${AWS_REGION}
credential_process = /usr/local/bin/aws_signing_helper credential-process --certificate ${CERT_DEST_DIR}/client.crt --private-key ${CERT_DEST_DIR}/client.key --trust-anchor-arn ${TRUST_ANCHOR_ARN} --profile-arn ${PROFILE_ARN} --role-arn ${ROLE_ARN}
EOF
  ok "Profile [${AWS_PROFILE_NAME}] written"
fi

# ---------------------------------------------------------------------------
# 5. Verify credentials
# ---------------------------------------------------------------------------

info "Verifying credentials..."
AWS_PROFILE="${AWS_PROFILE_NAME}" aws sts get-caller-identity
ok "Credentials working"

# ---------------------------------------------------------------------------
# 6. Install OpenClaw plugin (optional)
# ---------------------------------------------------------------------------

if [ "$SKIP_OPENCLAW" = "1" ]; then
  info "Skipping OpenClaw plugin install (SKIP_OPENCLAW=1)"
elif command -v openclaw &>/dev/null; then
  info "Installing OpenClaw plugin via CLI..."
  openclaw plugins install @agenticvault/agentic-vault-openclaw
  ok "OpenClaw plugin installed"
else
  info "OpenClaw CLI not found, using npx installer..."
  npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup
  ok "OpenClaw plugin installed"
fi

# ---------------------------------------------------------------------------
# 7. Configure systemd env for OpenClaw gateway (optional)
# ---------------------------------------------------------------------------

if [ "$SKIP_SYSTEMD" = "1" ]; then
  info "Skipping systemd env setup (SKIP_SYSTEMD=1)"
elif ! systemctl --user list-unit-files openclaw-gateway.service &>/dev/null 2>&1 \
     || ! systemctl --user list-unit-files openclaw-gateway.service 2>/dev/null | grep -q openclaw-gateway; then
  info "openclaw-gateway user service not found — skipping systemd env setup"
  info "Install OpenClaw gateway first, then re-run"
else
  info "Configuring systemd user service env..."
  mkdir -p ~/.config/systemd/user/openclaw-gateway.service.d

  cat > ~/.config/systemd/user/openclaw-gateway.service.d/10-aws.conf << EOF
[Service]
Environment="AWS_PROFILE=${AWS_PROFILE_NAME}"
Environment="AWS_SDK_LOAD_CONFIG=1"
Environment="AWS_CONFIG_FILE=%h/.aws/config"
Environment="AWS_SHARED_CREDENTIALS_FILE=%h/.aws/credentials"
EOF

  systemctl --user daemon-reload
  systemctl --user restart openclaw-gateway
  ok "systemd env configured and gateway restarted"
fi

# ---------------------------------------------------------------------------
echo ""
echo "── Setup complete ──"
echo ""
echo "Next steps:"
echo "  1. Verify vault:  AWS_PROFILE=${AWS_PROFILE_NAME} agentic-vault-mcp --key-id YOUR_KEY_ID --region ${AWS_REGION}"
echo "  2. Configure OpenClaw plugin: add keyId + region to plugins.entries.agentic-vault-openclaw.config"
echo "  3. Full guide: docs/guides/iam-roles-anywhere-setup.md"
