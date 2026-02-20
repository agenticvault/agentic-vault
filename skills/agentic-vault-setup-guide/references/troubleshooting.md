# Troubleshooting

## Certificate Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `Incorrect basic constraints for CA certificate` | CA cert missing `CA:TRUE` | Regenerate CA with `-addext "basicConstraints=critical,CA:TRUE"` |
| `Untrusted certificate. Insufficient certificate` | Client cert missing extensions | Re-sign with `-extfile` containing `keyUsage: digitalSignature` + `extendedKeyUsage: clientAuth` |
| `unable to parse private key` | Key file permissions too restrictive for app user | `sudo chmod 440` + `sudo chown root:<your-group>` on the key file |
| Cert expired | Client cert > 1 year old | Renew: see `references/aws-dev-setup.md` "Cert Renewal" section |
| `verify error:num=20:unable to get local issuer certificate` | CA cert not matching or corrupted | Re-verify: `openssl verify -CAfile ca.pem client.crt` |

## AWS Roles Anywhere

| Problem | Cause | Fix |
|---------|-------|-----|
| `Trust anchor is disabled` | Not enabled after creation | `aws rolesanywhere enable-trust-anchor --trust-anchor-id TA_ID --region REGION` |
| `Profile is disabled` | Not enabled after creation | `aws rolesanywhere enable-profile --profile-id PROFILE_ID --region REGION` |
| `Access denied` on KMS | Role missing permissions | Check inline policy has `kms:Sign`, `kms:GetPublicKey`, `kms:DescribeKey`; verify KMS key ARN matches |
| `credential_process` fails silently | Wrong cert path or ARN in `~/.aws/config` | Verify paths exist, ARNs are correct, cert not expired |
| `No credential providers found` | `AWS_PROFILE` not set or config file not found | Set `AWS_PROFILE=rolesanywhere-kms` and verify `~/.aws/config` exists |

### Diagnosing credential_process

Run the credential_process command manually to see errors:

```bash
/usr/local/bin/aws_signing_helper credential-process \
  --certificate /etc/pki/rolesanywhere/client.crt \
  --private-key /etc/pki/rolesanywhere/client.key \
  --trust-anchor-arn TA_ARN \
  --profile-arn PROFILE_ARN \
  --role-arn ROLE_ARN
```

Should output JSON with `AccessKeyId`, `SecretAccessKey`, `SessionToken`, `Expiration`.

## Signing Helper

| Problem | Cause | Fix |
|---------|-------|-----|
| Downloaded XML instead of binary | URL path case wrong (e.g. `AARCH64` instead of `Aarch64`) | Use `file /tmp/aws_signing_helper` to check; use exact casing: `Aarch64` or `X86_64` |
| `Exec format error` | Binary architecture mismatch | Check `uname -m`; re-download correct architecture |
| `unable to use cert store signer on linux` | `credential_process` has backslash line continuations | Must be a single line in `~/.aws/config`; remove all `\` newlines |
| `Unable to parse config file` | Malformed `~/.aws/config` (e.g. duplicate profiles) | Overwrite with `cat >` (not `>>`) to clean up; verify with `cat ~/.aws/config` |
| `Command 'aws' not found` | AWS CLI not installed | Install AWS CLI v2; see `references/vm-setup.md` Step 6 |

## OpenClaw Plugin

| Problem | Cause | Fix |
|---------|-------|-----|
| Plugin not listed in `openclaw plugins list` | Not installed or wrong directory name | Re-install: `openclaw plugins install @agenticvault/agentic-vault-openclaw` |
| `plugin id mismatch` warning | Config key doesn't match manifest id | Ensure config key is `"agentic-vault-openclaw"` (not `"agentic-vault"` or `"openclaw"`) |
| All vault tool calls rejected | No policy file or deny-all policy | Create `policy.json` and set `policyConfigPath` in plugin config |
| `vault_get_balance` fails | `rpcUrl` not configured | Add `rpcUrl` to plugin config |
| `vault_send_transfer` rejected | Policy doesn't allow the operation | Check `allowedChainIds`, `allowedContracts`, `allowedSelectors` in policy |

## OpenClaw Gateway (systemd)

| Problem | Cause | Fix |
|---------|-------|-----|
| `Could not load credentials from any providers` | Gateway process missing `AWS_PROFILE` env var | Add systemd drop-in with AWS env vars (see `references/openclaw-config.md` Step 14) |
| Env vars set but still fails | Both system and user service running; env set on wrong one | Check `openclaw gateway status` for active service file path; add env to that service |
| `Chain ID mismatch: requested N but RPC returned M` | `rpcUrl` points to wrong network | Match RPC endpoint to target chain (mainnet vs Sepolia vs other) |

### Identifying active gateway service

```bash
# Which service file is OpenClaw actually using?
openclaw gateway status

# Are both running? (this is the #1 cause of "env vars set but not working")
systemctl is-active openclaw-gateway          # system service
systemctl --user is-active openclaw-gateway   # user service
```

If both are active, disable the one you're not using:

```bash
# Keep user service, disable system service
sudo systemctl disable --now openclaw-gateway
sudo systemctl mask openclaw-gateway

# Verify
systemctl is-enabled openclaw-gateway          # Should show: masked
systemctl --user is-active openclaw-gateway    # Should show: active
```

### Verifying env vars are loaded

```bash
# For user service
systemctl --user show openclaw-gateway -p Environment \
  | tr ' ' '\n' | grep 'AWS_'

# For system service
systemctl show openclaw-gateway -p Environment \
  | tr ' ' '\n' | grep 'AWS_'
```

## Quick Diagnostic Sequence

When something isn't working, run these in order:

```bash
# 1. Can we get credentials at all?
AWS_PROFILE=rolesanywhere-kms aws sts get-caller-identity

# 2. Can we reach KMS?
AWS_PROFILE=rolesanywhere-kms aws kms get-public-key \
  --key-id alias/agentic-vault-signer --region REGION

# 3. Is the plugin loaded?
openclaw plugins list

# 4. Is the gateway service env correct?
openclaw gateway status
systemctl --user show openclaw-gateway -p Environment | tr ' ' '\n'

# 5. Test vault directly
# Use vault_get_address — should return 0x... address
# Use vault_health_check — should return healthy
```
