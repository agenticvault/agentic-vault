# CLI Usage Examples

> **Feature**: defi-protocol-integration (Phase 6)
> **Binary**: `agentic-vault`
> **Verified**: 2026-02-14

## Quick Reference

| Command | Needs AWS | Description |
|---------|-----------|-------------|
| `dry-run` | No | Decode calldata + policy check (no signing) |
| `sign` | Yes | Decode + policy + sign DeFi transaction |
| `sign-permit` | Yes | Sign EIP-2612 permit |
| `get-address` | Yes | Get vault wallet address |
| `health` | Yes | Check KMS signer health |
| `mcp` | Yes | Start MCP stdio server |

## Global Options

```bash
agentic-vault <command> \
  --key-id <aws-kms-key-id> \      # Required (except dry-run)
  --region <aws-region> \            # Required (except dry-run)
  --expected-address <0x...> \       # Optional: address verification
  --policy-config <path.json>        # Optional: policy config file
```

## dry-run (No AWS Required)

Decode calldata and run policy check without signing. Useful for testing policy configs.

### ERC20 approve

```bash
agentic-vault dry-run \
  --policy-config policy.json \
  --chain-id 1 \
  --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --data 0x095ea7b3000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef0000000000000000000000000000000000000000000000000000000000000001
```

Output (approved):

```json
{
  "protocol": "erc20",
  "action": "approve",
  "chainId": 1,
  "to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "intent": {
    "protocol": "erc20",
    "action": "approve",
    "selector": "0x095ea7b3",
    "args": {
      "spender": "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
      "amount": "1"
    }
  },
  "evaluation": { "allowed": true, "violations": [] }
}
```

### Uniswap V3 exactInputSingle

```bash
agentic-vault dry-run \
  --policy-config policy.json \
  --chain-id 1 \
  --to 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 \
  --data 0x04e45aaf000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000000000000000000000000000006f05b59d3b200000000000000000000000000000000000000000000000000000000000035a4e9000000000000000000000000000000000000000000000000000000000000000000 \
  --value 500000000000000000
```

Output (approved):

```json
{
  "protocol": "uniswap_v3",
  "action": "exactInputSingle",
  "chainId": 1,
  "to": "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
  "intent": {
    "protocol": "uniswap_v3",
    "action": "exactInputSingle",
    "selector": "0x04e45aaf",
    "args": {
      "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "tokenOut": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "fee": 3000,
      "recipient": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "amountIn": "500000000000000000",
      "amountOutMinimum": "900000000",
      "sqrtPriceLimitX96": "0"
    }
  },
  "evaluation": { "allowed": true, "violations": [] }
}
```

### Unknown Protocol (Fail-Closed)

```bash
agentic-vault dry-run \
  --chain-id 999 \
  --to 0x0000000000000000000000000000000000000bad \
  --data 0xdeadbeef
```

Output (denied):

```
Rejected: No registered decoder for contract 0x0000000000000000000000000000000000000bad on chain 999
```

## sign

Sign a DeFi transaction (requires AWS KMS credentials).

```bash
agentic-vault sign \
  --key-id alias/my-kms-key \
  --region us-east-1 \
  --policy-config policy.json \
  --chain-id 1 \
  --to 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --data 0x095ea7b3... \
  --value 0
```

Output: signed transaction hex (`0x02f8...`)

## sign-permit

Sign an EIP-2612 permit (requires AWS KMS credentials + payload JSON file).

```bash
# Prepare payload file
cat > permit-payload.json << 'EOF'
{
  "domain": {
    "name": "USD Coin",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  },
  "types": {
    "Permit": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "nonce", "type": "uint256" },
      { "name": "deadline", "type": "uint256" }
    ]
  },
  "message": {
    "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "spender": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    "value": "1000000",
    "nonce": "0",
    "deadline": "1700000000"
  }
}
EOF

# Sign
agentic-vault sign-permit \
  --key-id alias/my-kms-key \
  --region us-east-1 \
  --policy-config policy.json \
  --chain-id 1 \
  --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --spender 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 \
  --value 1000000 \
  --deadline 1700000000 \
  --payload permit-payload.json
```

Output: `{"v":27,"r":"0x...","s":"0x..."}`

## get-address / health

```bash
# Get vault wallet address
agentic-vault get-address --key-id alias/my-kms-key --region us-east-1

# Check KMS health
agentic-vault health --key-id alias/my-kms-key --region us-east-1
```

## mcp

Start MCP stdio server (backward compatible with `agentic-vault-mcp`).

```bash
# Standard mode
agentic-vault mcp --key-id alias/my-kms-key --region us-east-1

# With raw signing enabled (dangerous)
agentic-vault mcp --key-id alias/my-kms-key --region us-east-1 --unsafe-raw-sign

# With policy config
agentic-vault mcp --key-id alias/my-kms-key --region us-east-1 --policy-config policy.json
```

## Policy Config Format

```json
{
  "allowedChainIds": [1, 137],
  "allowedContracts": [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"
  ],
  "allowedSelectors": ["0x095ea7b3", "0x04e45aaf"],
  "maxAmountWei": "1000000000000000000",
  "maxDeadlineSeconds": 3600,
  "protocolPolicies": {
    "erc20": {
      "tokenAllowlist": ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
      "recipientAllowlist": ["0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"],
      "maxAllowanceWei": "1000000000000000000"
    },
    "uniswap_v3": {
      "tokenAllowlist": [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      ],
      "recipientAllowlist": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"],
      "maxSlippageBps": 100
    }
  }
}
```

## Error Output Format

All errors output structured JSON to stderr:

```json
{
  "timestamp": "2026-02-14T02:30:25.051Z",
  "service": "agentic-vault-cli",
  "level": "error",
  "message": "--key-id is required"
}
```

Policy denial includes full audit trail:

```json
{
  "timestamp": "...",
  "traceId": "...",
  "service": "agentic-vault-cli",
  "action": "dry-run",
  "who": "cli",
  "what": "Policy denied erc20:approve on chain 1",
  "why": "Violations: chainId 1 not in allowed list []",
  "result": "denied",
  "details": { "chainId": 1, "to": "0x...", "violations": ["..."] }
}
```

## Supported Protocols

| Protocol | Selector | Action | Networks |
|----------|----------|--------|----------|
| ERC-20 | `0x095ea7b3` | `approve` | All (interface decoder) |
| ERC-20 | `0xa9059cbb` | `transfer` | All (interface decoder) |
| Uniswap V3 | `0x04e45aaf` | `exactInputSingle` | Mainnet, Sepolia |
