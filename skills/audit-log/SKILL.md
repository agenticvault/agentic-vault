# Audit Log

Review and analyze audit logs from the Agentic Vault MCP server.

## When to use

Use this skill when the user wants to:
- Review past signing operations
- Check audit trail for security review
- Analyze transaction signing history

## Instructions

1. Audit logs are written to stderr by the MCP server in JSON format.
2. Each log entry contains:
   - `timestamp`: When the operation occurred
   - `traceId`: Unique trace identifier
   - `service`: Always 'agentic-vault-mcp'
   - `action`: The tool name (e.g., 'sign_swap')
   - `who`: Caller identity
   - `what`: Description of the operation
   - `why`: Context/reason
   - `result`: 'approved', 'denied', or 'error'
   - `details`: Additional operation details

3. Logs never contain private keys, secrets, or full addresses.

## Example

```
Review the audit logs to show all recent signing operations and their results.
```
