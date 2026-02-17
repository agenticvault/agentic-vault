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
| Static credentials (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`) | CI/CD, containers |
| Session token (`AWS_SESSION_TOKEN`) | Temporary credentials |

## Environment Variables

```bash
VAULT_KEY_ID=alias/my-signing-key   # KMS key ID or alias
VAULT_REGION=us-east-1              # AWS region
```

Both CLI and MCP server use these as fallbacks when `--key-id` / `--region` flags are omitted. See [`.env.example`](../../.env.example).
