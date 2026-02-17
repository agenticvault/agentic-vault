# AWS KMS Setup

## Key Creation

Create an ECC secp256k1 key in AWS KMS:

```bash
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "Agentic Vault EVM signing key"
```

## IAM Policy

Minimum required permissions for the signing service:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["kms:Sign", "kms:GetPublicKey", "kms:DescribeKey"],
      "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
    }
  ]
}
```

## Authentication Methods

Agentic Vault uses the standard AWS SDK credential chain. Any of these methods work:

| Method | Use Case |
|--------|----------|
| AWS SSO (`aws sso login`) | Local development |
| IAM role (instance profile) | EC2 / ECS / Lambda |
| IAM Roles Anywhere (`credential_process`) | On-prem VMs / non-AWS cloud |
| Static credentials (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`; + `AWS_SESSION_TOKEN` for temporary credentials) | CI/CD, containers |
| Named profile (`AWS_PROFILE`) | Any environment with `~/.aws/config` and/or `~/.aws/credentials` |

### IAM Roles Anywhere (VM / On-Prem)

For VMs outside AWS (on-prem, GCP, Azure, etc.), use [IAM Roles Anywhere](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html) to obtain temporary STS credentials via X.509 client certificates. No code changes are required — the AWS SDK credential chain includes `credential_process` natively.

**AWS-side setup (one-time):**

1. Create a **Trust Anchor** pointing to your private CA (AWS Private CA or external CA PEM)
2. Create an **IAM Role** with trust policy for `rolesanywhere.amazonaws.com` (lock down with `Condition` on `aws:SourceArn` + certificate fields)
3. Create a **Roles Anywhere Profile** linking the role

**IAM Role permissions (minimum for agentic-vault):**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["kms:Sign", "kms:GetPublicKey", "kms:DescribeKey"],
    "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
  }]
}
```

**VM-side setup:**

1. Install [`aws_signing_helper`](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/credential-helper.html) on the VM
2. Place client certificate + private key on the VM (restrict key to `0400`)
3. Configure `~/.aws/config`:

```ini
[profile rolesanywhere-kms]
region = us-east-1
credential_process = /usr/local/bin/aws_signing_helper credential-process \
  --certificate /etc/pki/rolesanywhere/client.crt \
  --private-key /etc/pki/rolesanywhere/client.key \
  --trust-anchor-arn arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/TA_ID \
  --profile-arn arn:aws:rolesanywhere:REGION:ACCOUNT:profile/PROFILE_ID \
  --role-arn arn:aws:iam::ACCOUNT:role/YOUR_ROLE_NAME
```

4. Start the MCP server:

```bash
AWS_PROFILE=rolesanywhere-kms agentic-vault-mcp \
  --key-id alias/my-signing-key \
  --region us-east-1
```

Credentials are automatically refreshed by the SDK before expiry. Long-running MCP server processes work without manual intervention.

**Security recommendations:**
- Always add `Condition` to the role trust policy (lock `aws:SourceArn` + certificate Subject/Issuer/SAN)
- Use TPM or OS secure store for the private key when possible
- Keep session duration short (default 1 hour / 3600s; configurable 15 minutes to 12 hours)

## Environment Variables

```bash
VAULT_KEY_ID=alias/my-signing-key   # KMS key ID or alias
VAULT_REGION=us-east-1              # AWS region
```

Both CLI and MCP server use these as fallbacks when `--key-id` / `--region` flags are omitted. See [`.env.example`](../../.env.example).
