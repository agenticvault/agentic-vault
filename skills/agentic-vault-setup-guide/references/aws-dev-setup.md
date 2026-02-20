# Phase 1: AWS Setup (Dev Machine)

All steps in this phase run on the dev machine that has AWS access (via SSO or IAM user).

## Prerequisites

| Tool | Purpose |
|------|---------|
| AWS CLI + active profile | Create AWS resources |
| OpenSSL | Generate CA + client cert |
| `op` CLI (optional) | Store CA key in 1Password |

## Step 1: Create KMS Key

```bash
# Login to AWS (if SSO)
aws sso login --profile YOUR_PROFILE
export AWS_PROFILE=YOUR_PROFILE

# Create ECC secp256k1 key (the only curve compatible with Ethereum)
aws kms create-key \
  --key-spec ECC_SECG_P256K1 \
  --key-usage SIGN_VERIFY \
  --description "Agentic Vault EVM signing key" \
  --region REGION

# Note the KeyId from the output, then create an alias
aws kms create-alias \
  --alias-name alias/agentic-vault-signer \
  --target-key-id KEY_ID \
  --region REGION
```

**Verify**: `aws kms describe-key --key-id KEY_ID --region REGION` should show `KeyState: Enabled`.

## Step 2: Create CA + Client Certificate

Use a self-signed OpenSSL CA (free, sufficient for Roles Anywhere). AWS Private CA (~$400/month) is not needed.

```bash
mkdir -p ~/rolesanywhere-ca && cd ~/rolesanywhere-ca

# --- CA key + self-signed cert (10 years) ---
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key \
  -out ca.pem \
  -subj "/CN=AgenticVault RolesAnywhere CA/O=YourOrg" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"
```

**Gotcha**: Without `basicConstraints=critical,CA:TRUE`, the Trust Anchor creation will fail with `Incorrect basic constraints for CA certificate`.

```bash
# --- Client key + cert (1 year) ---
cat > client-ext.cnf << 'EXTEOF'
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = clientAuth
EXTEOF

openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr \
  -subj "/CN=agentic-vault-vm/O=YourOrg"
openssl x509 -req -days 365 \
  -in client.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -extfile client-ext.cnf \
  -out client.crt
rm client-ext.cnf
```

**Gotcha**: Without `keyUsage: digitalSignature` + `extendedKeyUsage: clientAuth` on the client cert, Roles Anywhere rejects with `Untrusted certificate. Insufficient certificate`.

**Verify**:

```bash
openssl verify -CAfile ca.pem client.crt
# => client.crt: OK

openssl x509 -in client.crt -noout -text | grep -A1 "Key Usage"
# Should show: Digital Signature + TLS Web Client Authentication
```

## Step 3: Store CA Key Securely

The CA key can sign new client certs — it must not remain on disk.

**Option A: 1Password (`op` CLI)**

```bash
op item create \
  --category "Secure Note" \
  --title "AgenticVault RolesAnywhere CA Key" \
  --tags "aws,agentic-vault" \
  "notesPlain=$(cat ca.key)"

rm ca.key
```

**Option B: Encrypted USB / offline storage**

```bash
cp ca.key /Volumes/SECURE_USB/
rm ca.key
```

## Step 4: Create AWS Roles Anywhere Resources

```bash
export AWS_PROFILE=YOUR_PROFILE
```

### 4a. Trust Anchor

```bash
python3 -c "
import json
cert = open('$HOME/rolesanywhere-ca/ca.pem').read()
d = {
  'name': 'agentic-vault-anchor',
  'source': {
    'sourceType': 'CERTIFICATE_BUNDLE',
    'sourceData': { 'x509CertificateData': cert }
  }
}
json.dump(d, open('/tmp/trust-anchor.json','w'))
"

aws rolesanywhere create-trust-anchor \
  --cli-input-json file:///tmp/trust-anchor.json \
  --region REGION

# Enable it (created disabled by default)
aws rolesanywhere enable-trust-anchor \
  --trust-anchor-id TA_ID \
  --region REGION
```

### 4b. IAM Role

```bash
TA_ARN="arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/TA_ID"

cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "rolesanywhere.amazonaws.com" },
    "Action": ["sts:AssumeRole", "sts:TagSession", "sts:SetSourceIdentity"],
    "Condition": {
      "StringEquals": { "aws:SourceAccount": "ACCOUNT" },
      "ArnEquals": { "aws:SourceArn": "${TA_ARN}" }
    }
  }]
}
EOF

aws iam create-role \
  --role-name agentic-vault-signer \
  --assume-role-policy-document file:///tmp/trust-policy.json
```

### 4c. KMS Permissions

```bash
KMS_KEY_ARN="arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"

cat > /tmp/kms-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["kms:Sign", "kms:GetPublicKey", "kms:DescribeKey"],
    "Resource": "${KMS_KEY_ARN}"
  }]
}
EOF

aws iam put-role-policy \
  --role-name agentic-vault-signer \
  --policy-name kms-sign \
  --policy-document file:///tmp/kms-policy.json
```

### 4d. Roles Anywhere Profile

```bash
ROLE_ARN=$(aws iam get-role --role-name agentic-vault-signer \
  --query "Role.Arn" --output text)

aws rolesanywhere create-profile \
  --name "agentic-vault-profile" \
  --role-arns "${ROLE_ARN}" \
  --region REGION

# Enable it
aws rolesanywhere enable-profile \
  --profile-id PROFILE_ID \
  --region REGION
```

### 4e. Clean Up Temp Files

```bash
rm -f /tmp/trust-anchor.json /tmp/trust-policy.json /tmp/kms-policy.json
```

## Step 5: Transfer to VM

```bash
# Record ARNs for VM config
echo "TA_ARN:      arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/TA_ID"
echo "PROFILE_ARN: arn:aws:rolesanywhere:REGION:ACCOUNT:profile/PROFILE_ID"
echo "ROLE_ARN:    arn:aws:iam::ACCOUNT:role/agentic-vault-signer"

# Transfer client cert + key (never ca.key!)
scp ~/rolesanywhere-ca/client.crt user@VM_IP:/tmp/
scp ~/rolesanywhere-ca/client.key user@VM_IP:/tmp/
```

## Cert Renewal (Annual)

Client certs expire after 1 year. Retrieve the CA key, sign a new cert, deploy to VM.

```bash
# On dev machine: retrieve CA key from 1Password
op item get "AgenticVault RolesAnywhere CA Key" \
  --fields notesPlain --format json \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['value'])" \
  > ca.key && chmod 400 ca.key

# Sign new client cert (must include extensions)
cat > client-ext.cnf << 'EXTEOF'
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = clientAuth
EXTEOF

openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr \
  -subj "/CN=agentic-vault-vm/O=YourOrg"
openssl x509 -req -days 365 \
  -in client.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -extfile client-ext.cnf \
  -out client.crt
rm client-ext.cnf

# Transfer to VM
scp client.crt client.key user@VM_IP:/tmp/

# On VM: replace certs
sudo install -m 444 /tmp/client.crt /etc/pki/rolesanywhere/client.crt
sudo install -m 440 /tmp/client.key /etc/pki/rolesanywhere/client.key
sudo chown root:$(id -gn) /etc/pki/rolesanywhere/client.key
rm /tmp/client.crt /tmp/client.key
# Restart MCP server or OpenClaw gateway

# Delete CA key from disk
rm ca.key
```
