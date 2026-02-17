# Release Infrastructure

> **Created**: 2026-02-15
> **Status**: Implementation Done (pending commit)
> **Priority**: P0
> **Feature**: v0-initial-release
> **Depends on**: [2026-02-15-namespace-migration.md](./2026-02-15-namespace-migration.md)

## Background

v0.1.0 發佈前需要完整的自動化發佈基礎設施。包含兩部分：

1. **GitHub Actions Trusted Publishing** — OIDC-based npm 認證，取代 `NPM_TOKEN` secret
2. **TypeScript release script** — 本地發佈腳本，涵蓋 preflight 檢查、版本 bump、tag 建立

## Requirements

### Release Workflows（GHA Trusted Publishing）

| # | Item | Description |
|---|------|-------------|
| W1 | `release.yml` | `v*` tag 觸發，OIDC + `--provenance`，發佈 `@agenticvault/agentic-vault` |
| W2 | `release-openclaw.yml` | `openclaw-v*` tag 觸發，`pnpm pack` → `npm publish *.tgz`，發佈 `@agenticvault/openclaw` |
| W3 | npm CLI 升級 | Node 22 內建 npm 10.x，需升級至 `npm@^11`（OIDC 需 11.5.1+） |
| W4 | `publishConfig` | 兩個 `package.json` 加入 `access: "public"` + `registry` |

### Release Script（TypeScript）

| # | Item | Description |
|---|------|-------------|
| S1 | `preflight` | 檢查 npm auth、git status、build、lint、test、tarball 內容 |
| S2 | `first-publish` | 一次性手動發佈（core + openclaw），含 dry-run 模式 |
| S3 | `bump <version>` | 更新兩個 `package.json` + peerDep + lockfile + 驗證 |
| S4 | `tag` | 建立帶註解的 git tag 並推送（觸發 GHA workflows） |
| S5 | Shell safety | `assertShellSafe()` 驗證所有動態值，防止 command injection |
| S6 | Unit tests | 59 tests，涵蓋 happy path + error paths + dry-run + security validation |

## Scope

| Scope | Description |
|-------|-------------|
| In | GHA workflows（Trusted Publishing）、TypeScript release script + tests |
| Out | npm publish 本身（屬 v1-release）、Trusted Publisher npm 端設定（手動操作） |

## Related Files

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/release.yml` | Modify | OIDC permissions、npm@^11、`--provenance` |
| `.github/workflows/release-openclaw.yml` | Modify | OIDC、`pnpm pack` → `npm publish *.tgz`、`--provenance` |
| `package.json` | Modify | 新增 `publishConfig` |
| `packages/openclaw-plugin/package.json` | Modify | 新增 `publishConfig` |
| `scripts/release.ts` | New | TypeScript 發佈腳本（4 subcommands） |
| `test/unit/scripts/release.test.ts` | New | 59 unit tests |

## Acceptance Criteria

### Workflows
- [x] `release.yml` 使用 OIDC（`id-token: write`），無 `NPM_TOKEN`
- [x] `release-openclaw.yml` 使用 `pnpm pack` + `npm publish *.tgz`
- [x] 兩個 workflow 升級至 `npm@^11`
- [x] 兩個 `package.json` 包含 `publishConfig`
- [x] Codex review 通過

### Release Script
- [x] `preflight` subcommand 實作（npm auth + git + build + lint + test + tarball）
- [x] `first-publish` subcommand 實作（含 dry-run）
- [x] `bump` subcommand 實作（版本 + peerDep + lockfile）
- [x] `tag` subcommand 實作（含 dry-run）
- [x] `assertShellSafe()` 防護所有動態 shell 值
- [x] `findTarball` 清除舊 tarball 再打包
- [x] `gitTagExists` 使用 `refs/tags/` 前綴
- [x] 59 unit tests 全數通過
- [x] Codex review 通過（3 輪，shell safety hardening）

### CI Gates
- [x] `pnpm typecheck` 通過
- [x] `pnpm lint` 通過
- [x] `pnpm test:unit` 通過（529 tests）
- [x] `pnpm build` 成功

## Post-Publish Setup（手動操作）

發佈第一版後需在 npmjs.com 設定 Trusted Publisher：

| Package | Workflow | Organization | Repository |
|---------|----------|-------------|------------|
| `@agenticvault/agentic-vault` | `release.yml` | `agenticvault` | `agentic-vault` |
| `@agenticvault/openclaw` | `release-openclaw.yml` | `agenticvault` | `agentic-vault` |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | 使用者提供 Trusted Publishing 完整說明 |
| Development | Done | Workflows + release script + 59 tests |
| Testing | Done | 529 tests pass, Codex review x3 pass |
| Acceptance | Pending commit | 等 git commit 後完成 |

## References

- npm Trusted Publishing: https://docs.npmjs.com/generating-provenance-statements
- v1 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
- Namespace Migration: [2026-02-15-namespace-migration.md](./2026-02-15-namespace-migration.md)
