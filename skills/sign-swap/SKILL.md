# Sign Swap

Sign a swap transaction through the Agentic Vault MCP server.

## When to use

Use this skill when the user wants to sign a token swap transaction on a supported chain.

## Instructions

1. Use the `sign_swap` MCP tool with the following parameters:
   - `chainId`: The target chain ID (e.g., 1 for Ethereum mainnet)
   - `to`: The DEX router contract address
   - `data`: The encoded swap calldata
   - `value`: (Optional) ETH value in wei

2. The tool enforces policy constraints:
   - Chain ID must be whitelisted
   - Contract must be whitelisted
   - Function selector must be whitelisted
   - Transaction value must be within limits

3. Never import or access signing keys directly. Always use the MCP tool.

## Example

```
Use the sign_swap tool to sign a swap on chain 1 to router 0x... with calldata 0x...
```
