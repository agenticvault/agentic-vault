# Check Wallet

Check the wallet address and health status through the Agentic Vault MCP server.

## When to use

Use this skill when the user wants to:
- View their wallet address
- Verify KMS key configuration
- Check wallet health status

## Instructions

1. Use the `get_address` MCP tool to retrieve the wallet's Ethereum address.
2. Use the `health_check` MCP tool to verify the KMS key configuration is valid.

3. Never import or access signing keys directly. Always use the MCP tools.

## Example

```
Use get_address to show the wallet address, then use health_check to verify the setup.
```
