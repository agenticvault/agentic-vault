# Phase 3: OpenClaw Plugin + Policy

## Step 11: Install Plugin

**Recommended** (OpenClaw CLI):

```bash
openclaw plugins install @agenticvault/agentic-vault-openclaw
```

Verify:

```bash
openclaw plugins list
# Should show: agentic-vault-openclaw
```

**Alternative** (npx installer, if OpenClaw CLI not available):

```bash
npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup
```

## Step 12: Configure Plugin

Add the plugin to OpenClaw host config (`~/.openclaw/config.json` or equivalent):

```json
{
  "plugins": {
    "allow": ["agentic-vault-openclaw"],
    "entries": {
      "agentic-vault-openclaw": {
        "config": {
          "keyId": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID",
          "region": "REGION",
          "policyConfigPath": "/home/user/policy.json",
          "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
        }
      }
    }
  }
}
```

| Option | Required | Description |
|--------|----------|-------------|
| `keyId` | Yes | AWS KMS key ARN or alias (e.g. `alias/agentic-vault-signer`) |
| `region` | Yes | AWS region where the KMS key lives |
| `policyConfigPath` | No | Path to policy JSON. Deny-all if omitted. |
| `rpcUrl` | No | RPC endpoint for on-chain operations (`vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer`). Not needed for signing-only use. |
| `expectedAddress` | No | Expected wallet address for startup verification |
| `enableUnsafeRawSign` | No | Enable raw signing tools (default: `false`). Keep disabled unless explicitly needed. |

## Step 13: Create Policy

Agentic Vault uses a **deny-by-default** policy. Without a policy file, all signing operations are rejected.

### Minimal Policy (ERC20 transfers only)

Start with the most restrictive useful policy and expand as needed:

```json
{
  "allowedChainIds": [1],
  "allowedContracts": [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  ],
  "allowedSelectors": [
    "0x095ea7b3",
    "0xa9059cbb"
  ],
  "maxAmountWei": "1000000000000000000",
  "protocolPolicies": {
    "erc20": {
      "maxAllowanceWei": "1000000000000000000",
      "tokenAllowlist": [
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      ]
    }
  }
}
```

### Selector Lookup Table

| Selector | Protocol | Function |
|----------|----------|----------|
| `0x095ea7b3` | ERC20 | `approve(spender, amount)` |
| `0xa9059cbb` | ERC20 | `transfer(to, amount)` |
| `0x04e45aaf` | Uniswap V3 | `exactInputSingle(params)` |
| `0x617ba037` | Aave V3 | `supply(asset, amount, onBehalfOf, referralCode)` |
| `0xa415bcad` | Aave V3 | `borrow(asset, amount, interestRateMode, referralCode, onBehalfOf)` |
| `0x573ade81` | Aave V3 | `repay(asset, amount, interestRateMode, onBehalfOf)` |
| `0x69328dec` | Aave V3 | `withdraw(asset, amount, to)` |

### Common Contract Addresses (Ethereum Mainnet)

| Token/Protocol | Address |
|---------------|---------|
| USDC | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |
| USDT | `0xdac17f958d2ee523a2206206994597c13d831ec7` |
| WETH | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` |
| DAI | `0x6b175474e89094c44da98b954eedeac495271d0f` |
| Uniswap V3 Router | `0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45` |
| Aave V3 Pool | `0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2` |

### Full Policy (ERC20 + Uniswap V3 + Aave V3)

```json
{
  "allowedChainIds": [1, 11155111],
  "allowedContracts": [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"
  ],
  "allowedSelectors": [
    "0x095ea7b3",
    "0xa9059cbb",
    "0x04e45aaf",
    "0x617ba037",
    "0xa415bcad",
    "0x573ade81",
    "0x69328dec"
  ],
  "maxAmountWei": "1000000000000000000",
  "maxDeadlineSeconds": 1800,
  "protocolPolicies": {
    "erc20": {
      "maxAllowanceWei": "1000000000000000000",
      "tokenAllowlist": [
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      ]
    },
    "uniswap_v3": {
      "maxSlippageBps": 100,
      "tokenAllowlist": [
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      ],
      "recipientAllowlist": []
    },
    "aave_v3": {
      "tokenAllowlist": [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      ],
      "maxInterestRateMode": 2,
      "maxAmountWei": "1000000000000000000",
      "recipientAllowlist": []
    }
  }
}
```

### Policy Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `allowedChainIds` | `number[]` | Chain IDs permitted (1=mainnet, 11155111=Sepolia) |
| `allowedContracts` | `string[]` | Contract addresses (lowercase hex) that can be called |
| `allowedSelectors` | `string[]` | 4-byte function selectors allowed |
| `maxAmountWei` | `string` | Max wei per operation (1e18 = 1 ETH) |
| `maxDeadlineSeconds` | `number` | Max permit/swap deadline in seconds |
| `protocolPolicies.erc20.maxAllowanceWei` | `string` | Max approve amount |
| `protocolPolicies.erc20.tokenAllowlist` | `string[]` | ERC20 tokens allowed for approve/transfer |
| `protocolPolicies.uniswap_v3.maxSlippageBps` | `number` | Max slippage in basis points (100 = 1%) |
| `protocolPolicies.uniswap_v3.tokenAllowlist` | `string[]` | Tokens allowed in swaps |
| `protocolPolicies.aave_v3.maxInterestRateMode` | `number` | Max interest rate mode (1=stable, 2=variable) |

## Step 14: Systemd Gateway Environment (Optional)

When OpenClaw gateway runs as a systemd service, it does not inherit shell environment variables. Add AWS credentials via a drop-in config.

First, identify which service is active:

```bash
openclaw gateway status
# Look for "Service file:" to determine system vs user service
```

**For user service** (most common):

```bash
mkdir -p ~/.config/systemd/user/openclaw-gateway.service.d

cat > ~/.config/systemd/user/openclaw-gateway.service.d/10-aws.conf << 'EOF'
[Service]
Environment="AWS_PROFILE=rolesanywhere-kms"
Environment="AWS_SDK_LOAD_CONFIG=1"
Environment="AWS_CONFIG_FILE=%h/.aws/config"
Environment="AWS_SHARED_CREDENTIALS_FILE=%h/.aws/credentials"
EOF

systemctl --user daemon-reload
systemctl --user restart openclaw-gateway
```

**Verify**:

```bash
systemctl --user show openclaw-gateway -p Environment \
  | tr ' ' '\n' | grep 'AWS_'
```

**For system service**:

```bash
sudo mkdir -p /etc/systemd/system/openclaw-gateway.service.d

sudo tee /etc/systemd/system/openclaw-gateway.service.d/10-aws.conf << EOF
[Service]
Environment="AWS_PROFILE=rolesanywhere-kms"
Environment="AWS_SDK_LOAD_CONFIG=1"
Environment="AWS_CONFIG_FILE=/home/$(whoami)/.aws/config"
Environment="AWS_SHARED_CREDENTIALS_FILE=/home/$(whoami)/.aws/credentials"
EOF

sudo systemctl daemon-reload
sudo systemctl restart openclaw-gateway
```

**If both system and user services are running** (causes confusion), disable the unused one:

```bash
# Keep user service, disable system service
sudo systemctl disable --now openclaw-gateway
sudo systemctl mask openclaw-gateway
```

## Multi-Agent Hardening

In multi-agent environments, restrict vault tools to only the designated financial agent:

```json
{
  "agents": {
    "general-assistant": {
      "tools": {
        "deny": [
          "vault_get_address", "vault_health_check", "vault_get_balance",
          "vault_sign_defi_call", "vault_sign_permit",
          "vault_send_transfer", "vault_send_erc20_transfer",
          "vault_sign_transaction", "vault_sign_typed_data"
        ]
      }
    }
  }
}
```

## Security Checklist

| Item | Requirement |
|------|------------|
| CA key | Stored in 1Password / offline. Never on VM. |
| Client key | `/etc/pki/rolesanywhere/client.key` with `chmod 440`, `root:<app-group>` |
| `enableUnsafeRawSign` | Keep `false` unless explicitly needed |
| Policy file | Start with minimal allowlist, expand gradually |
| RPC URL | Never commit to version control; use env vars or separate config |
| `tools.deny` | Block vault tools from non-financial agents |
