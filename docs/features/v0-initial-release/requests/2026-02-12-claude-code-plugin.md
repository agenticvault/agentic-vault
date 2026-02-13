# Claude Code Plugin Integration

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-mcp-server.md](./2026-02-12-mcp-server.md)

## Background

建立 Claude Code plugin，包含 `.claude-plugin/` 目錄結構、skills 定義、及透過 MCP 呼叫的 agent wrapper。Plugin 永遠不直接接觸私鑰。

## Requirements

- `.claude-plugin/plugin.json` 設定
- Skills：`sign-swap`、`sign-permit`、`check-wallet`、`audit-log`
- `.mcp.json` 指向本地 MCP server
- Skills 僅透過 MCP tools 操作

## Scope

| Scope | Description |
|-------|-------------|
| In | Claude Code plugin 結構、skills、MCP 橋接 |
| Out | OpenClaw plugin（Phase 2）、MCP server 本身 |

## Acceptance Criteria

- [x] `.claude-plugin/plugin.json` 格式正確
- [x] 至少 4 個 skills（sign-swap, sign-permit, check-wallet, audit-log）
- [x] Skills 透過 MCP 呼叫，不直接 import signer
- [x] `.mcp.json` 正確指向 MCP server
- [x] Plugin 安裝後 Claude Code 可偵測並使用 skills

## Dependencies

- MCP Server (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | Plugin structure + 4 skills |
| Testing | ✅ Done | Plugin assets included in package |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
