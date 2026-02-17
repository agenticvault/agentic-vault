# Layer Boundary Enforcement + Deferred Package Splitting

> **Created**: 2026-02-16
> **Status**: Done
> **Priority**: P1
> **Feature**: v0-initial-release
> **Depends on**: None (independent)
> **Source**: Brainstorming Nash Equilibrium — package splitting debate (Claude + Codex, `/codex-brainstorm`)

## Background

討論是否拆分 package 以提升模組化。Claude 與 Codex 獨立研究後達成共識：**v0.1.0 不拆包**，改用 ESLint 強制 layer boundary + 保留 subpath exports 作為 API surface。

目前狀態：
- `package.json` exports 已有 3 個 subpath：`.`、`./protocols`、`./agentic`
- `eslint.config.js` 已有 `src/agentic/` trust boundary（`no-restricted-imports`）
- `protocols/workflows/types.ts` 已為 interface-only（最強解耦點）
- 但 `src/protocols/` 和 `src/core/` 缺乏 ESLint boundary enforcement

## Current Dependency DAG

```
Layer 0: types.ts, signing-provider.ts (interfaces), evm-signer.util.ts
    ↑
Layer 1: core/evm-signer-adapter, providers/aws-kms/*, provider/factory
    ↑
Layer 2: protocols/* (decoders, policy, workflows — self-contained)
    ↑                    ↑ (workflow types = interfaces only)
Layer 3: agentic/mcp/*   cli/*   [packages/openclaw-plugin]
```

## Requirements

### Part 1: ESLint Layer Boundary Rules

| # | Layer | Rule | Description |
|---|-------|------|-------------|
| L1 | `src/core/**` | 禁止 import protocols, agentic, cli | Core 為最底層，只依賴 types + utils |
| L2 | `src/providers/**` | 禁止 import protocols, agentic, cli | Providers 只依賴 core interfaces + utils |
| L3 | `src/protocols/**` | 禁止 import agentic, cli, core internals | Protocols 自給自足，不依賴上下層 |
| L4 | `src/cli/**` | 禁止 import agentic internals（除 barrel） | CLI 透過 barrel import，不深入 agentic |

### Part 2: Deferred Package Splitting（文件記錄）

| # | Item | Description |
|---|------|-------------|
| D1 | 拆分觸發條件 | 記錄何時應拆分（任一成立即拆） |
| D2 | 拆分路線圖 | 記錄拆分順序（core → protocols → mcp → cli） |

#### 拆分觸發條件（任一成立即拆）

1. 外部消費者只需 signing core，不想裝 `@modelcontextprotocol/sdk` + `viem`
2. Protocol decoder 社群貢獻需要獨立版本週期
3. MCP adapter 需獨立發版（MCP SDK breaking change 不影響 core）

#### 拆分路線圖

| Phase | Package | Content |
|-------|---------|---------|
| 1 | `@agenticvault/core` | types + signing + providers |
| 2 | `@agenticvault/protocols` | decoders + policy + workflows |
| 3 | `@agenticvault/mcp` | MCP server + tools |
| 4 | `@agenticvault/cli` | CLI commands |
| — | `@agenticvault/openclaw` | 已存在 |

## Scope

| Scope | Description |
|-------|-------------|
| In | ESLint layer boundary rules（3 個新 config block）、拆分策略文件記錄 |
| Out | 實際拆包、TypeScript project references、workspace 重組 |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `eslint.config.js` | Modify | 新增 3 個 `no-restricted-imports` config blocks（core, providers, protocols） |
| `docs/project/adrs/ADR-001-architecture-decisions.md` | Modify | 新增 package splitting ADR section |

## Acceptance Criteria

### ESLint Rules
- [ ] `src/core/**` 禁止 import `protocols/`、`agentic/`、`cli/`
- [ ] `src/providers/**` 禁止 import `protocols/`、`agentic/`、`cli/`
- [ ] `src/protocols/**` 禁止 import `agentic/`、`cli/`
- [ ] `pnpm lint` 通過（現有程式碼已符合 boundary）
- [ ] 既有 `src/agentic/` trust boundary 保持不變

### Documentation
- [ ] ADR 新增 package splitting decision（選擇 Strategy D: Hybrid）
- [ ] 拆分觸發條件與路線圖記錄於 ADR

### CI Gates
- [ ] `pnpm typecheck` 通過
- [ ] `pnpm lint` 通過
- [ ] `pnpm test:unit` 通過
- [ ] `pnpm build` 成功

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| L1-L4. ESLint rules | #1 | Low | 防止 boundary violation |
| D1-D2. ADR 文件 | #2 | Low | 決策記錄 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium（Claude + Codex 共識不拆包） |
| Development | Done | 5 no-restricted-imports blocks in ESLint |
| Testing | Done | pnpm lint passes |
| Acceptance | Done | All AC verified |

## References

- Brainstorming: `/codex-brainstorm` package splitting session (Codex thread: `019c64b4-a37a-7dc0-b636-4c2d5c2b4405`)
- Current ESLint config: `eslint.config.js`（已有 agentic trust boundary）
- Workflow types: `src/protocols/workflows/types.ts`（interface-only contract）
- v0.1.0 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
