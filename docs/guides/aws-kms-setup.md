# AWS KMS Setup

## Key Creation

Create an ECC secp256k1 key in AWS KMS:

```bash
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "Agentic Vault EVM signing key" \
  --region REGION

# Create alias (note the key ID from output above)
aws kms create-alias \
  --alias-name alias/agentic-vault-signer \
  --target-key-id KEY_ID \
  --region REGION
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
| Static credentials (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`; + `AWS_SESSION_TOKEN` for temporary credentials) | CI/CD, containers (last resort) |
| Named profile (`AWS_PROFILE`) | Any environment with `~/.aws/config` and/or `~/.aws/credentials` |

### IAM Roles Anywhere (VM / On-Prem)

For VMs outside AWS (on-prem, GCP, Azure, etc.), use [IAM Roles Anywhere](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html) to obtain temporary STS credentials via X.509 client certificates. No long-lived AWS credentials on the VM.

| Component | Purpose |
|-----------|---------|
| Trust Anchor | Registers your CA with AWS |
| IAM Role | Defines KMS permissions |
| Roles Anywhere Profile | Links role to Trust Anchor |
| `aws_signing_helper` | Exchanges X.509 cert for STS credentials |

```bash
# VM-side: single command to start
AWS_PROFILE=rolesanywhere-kms agentic-vault-mcp \
  --key-id alias/agentic-vault-signer \
  --region ap-northeast-1
```

The trust policy should include `aws:SourceArn` + `aws:SourceAccount` conditions, and client key files must be `chmod 400`.

For the complete step-by-step walkthrough (CA creation, AWS setup, VM deployment), see **[IAM Roles Anywhere Setup](./iam-roles-anywhere-setup.md)**.

## Environment Variables

```bash
VAULT_KEY_ID=alias/my-signing-key   # KMS key ID or alias
VAULT_REGION=us-east-1              # AWS region
```

Both CLI and MCP server use these as fallbacks when `--key-id` / `--region` flags are omitted. See [`.env.example`](../../.env.example).
