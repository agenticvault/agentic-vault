# Policy Configuration Reference

The policy engine uses a JSON configuration file to define what signing operations are allowed. Without a policy file, all policy-guarded operations (DeFi calls, swaps, permits, transfers) are denied. Non-signing tools (`get_address`, `health_check`, `get_balance`) and raw signing tools (when opt-in via `--unsafe-raw-sign`) are unaffected by the policy file.

See [`policy.example.json`](../../policy.example.json) for a complete example.

## Example

```json
{
  "allowedChainIds": [1, 11155111],
  "allowedContracts": [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"
  ],
  "allowedSelectors": [
    "0x095ea7b3", "0xa9059cbb", "0x04e45aaf",
    "0x617ba037", "0xa415bcad", "0x573ade81", "0x69328dec"
  ],
  "maxAmountWei": "1000000000000000000",
  "maxDeadlineSeconds": 1800,
  "protocolPolicies": {
    "erc20": {
      "maxAllowanceWei": "1000000000000000000",
      "tokenAllowlist": ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]
    },
    "uniswap_v3": {
      "maxSlippageBps": 100,
      "tokenAllowlist": ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
      "recipientAllowlist": []
    },
    "aave_v3": {
      "tokenAllowlist": ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"],
      "maxInterestRateMode": 2,
      "maxAmountWei": "1000000000000000000"
    }
  }
}
```

## Base Policy Fields

| Field | Type | Description |
|-------|------|-------------|
| `allowedChainIds` | `number[]` | Allowed chain IDs |
| `allowedContracts` | `string[]` | Allowed contract addresses (case-insensitive) |
| `allowedSelectors` | `string[]` | Allowed 4-byte function selectors |
| `maxAmountWei` | `string \| number` | Maximum transaction value in wei (string recommended for large values) |
| `maxDeadlineSeconds` | `number` | Maximum deadline as seconds from now |

## Protocol Policy Fields (`protocolPolicies`)

| Field | Protocols | Description |
|-------|-----------|-------------|
| `tokenAllowlist` | all | Allowed token contract addresses |
| `recipientAllowlist` | erc20, uniswap_v3, aave_v3 | Allowed spender (approve) / recipient (transfer) addresses |
| `maxAllowanceWei` | erc20 | Maximum ERC-20 approval amount |
| `maxSlippageBps` | uniswap_v3 | When set, rejects swaps with `amountOutMinimum === 0` (no slippage protection). True BPS enforcement requires a price oracle (not yet implemented). |
| `maxInterestRateMode` | aave_v3 | Maximum Aave interest rate mode (1=stable, 2=variable) |
| `maxAmountWei` | aave_v3 | Maximum Aave operation amount |

## Schema Validation

Policy configuration is validated at load time using [Zod](https://zod.dev/) schemas. Invalid configuration causes an immediate error with field-level diagnostics. Key validation rules:

- Address fields (`allowedContracts`, `allowedSelectors`, `tokenAllowlist`, `recipientAllowlist`) must be `0x`-prefixed hex strings
- `maxAmountWei` accepts strings (recommended for large values) or safe integers
- All fields have sensible defaults (empty arrays, zero values) -- an empty `{}` config denies everything
- Unknown fields are preserved (forward compatible)
