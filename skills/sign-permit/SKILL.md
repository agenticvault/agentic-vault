# Sign Permit

Sign an EIP-2612 permit through the Agentic Vault MCP server.

## When to use

Use this skill when the user wants to sign a gasless token approval (EIP-2612 permit).

## Instructions

1. Use the `sign_permit` MCP tool with the following parameters:
   - `chainId`: The target chain ID
   - `token`: The ERC-20 token contract address
   - `spender`: The approved spender address
   - `value`: The approval amount in token units (string)
   - `deadline`: Unix timestamp for permit expiry
   - `domain`: The EIP-712 domain object
   - `types`: The EIP-712 types definition
   - `message`: The EIP-712 message object

2. The tool enforces policy constraints before signing.

3. Never import or access signing keys directly. Always use the MCP tool.

## Example

```
Use the sign_permit tool to approve 1000 USDC for spender 0x... on chain 1
```
