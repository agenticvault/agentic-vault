# Namespace Migration (Domain + npm Scope + GitHub Org)

> **Created**: 2026-02-15
> **Status**: Near Complete (pending repo transfer + commit)
> **Priority**: P0
> **Feature**: v0-initial-release
> **Depends on**: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md) (Done)
> **Source**: Brainstorming Nash Equilibrium (Claude + Codex, `/codex-brainstorm`)

## Background

`@sd0xdev` 是個人 GitHub namespace，不適合作為開源專案的長期品牌。v0.1.0 尚未發佈至 npm，此時遷移成本為零（無既有消費者）。

Brainstorming Nash Equilibrium 達成共識：遷移至 `agenticvault` 統一命名空間（domain + npm scope + GitHub org）。

## Requirements

### Phase 1: External Provisioning（手動操作）

| # | Item | Description |
|---|------|-------------|
| P1 | Domain 註冊 | `agenticvault.dev`（Cloudflare Registrar，~$10/yr） |
| P2 | GitHub Org 建立 | `agenticvault` organization |
| P3 | Repo 轉移 + 改名 | `sd0xdev/agentic-vault-wallet` → `agenticvault/agentic-vault` |
| P4 | npm Org 建立 | `agenticvault`（Free plan, unlimited public packages） |
| P5 | Email 設定 | `security@agenticvault.dev`（Cloudflare Email Routing → 個人信箱） |

### Phase 2: Code Rename（atomic commit）

| # | Item | Description |
|---|------|-------------|
| C1 | npm scope 更新 | `@sd0xdev/agentic-vault` → `@agenticvault/agentic-vault` |
| C2 | OpenClaw 套件更名 | `@sd0xdev/agentic-vault-openclaw` → `@agenticvault/openclaw` |
| C3 | Source imports 更新 | 4 files with `@sd0xdev/agentic-vault` imports |
| C4 | CI workflows 更新 | 3 workflow files with `--filter` references |
| C5 | Config 更新 | `.mcp.json.example`, `.claude-plugin/plugin.json` |
| C6 | Docs 更新 | README, CHANGELOG, CONTRIBUTING, SECURITY, ADR, request docs (~15 files) |
| C7 | Lock file 重建 | `pnpm install` regenerate `pnpm-lock.yaml` |
| C8 | SECURITY.md email | `security@sd0x.dev` → `security@agenticvault.dev` |

### Phase 3: Verify + Publish

| # | Item | Description |
|---|------|-------------|
| V1 | CI gates | `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build` |
| V2 | Tarball 驗證 | `pnpm pack --dry-run` both packages |
| V3 | npm publish | `--provenance --access public` both packages |

## Naming Map

| Item | Current | New |
|------|---------|-----|
| Domain | (none) | `agenticvault.dev` |
| GitHub Org | `sd0xdev` (personal) | `agenticvault` (org) |
| GitHub Repo | `sd0xdev/agentic-vault-wallet` | `agenticvault/agentic-vault` |
| npm Scope | `@sd0xdev` | `@agenticvault` |
| Core Package | `@sd0xdev/agentic-vault` | `@agenticvault/agentic-vault` |
| OpenClaw Package | `@sd0xdev/agentic-vault-openclaw` | `@agenticvault/openclaw` |
| Security Email | `security@sd0x.dev` | `security@agenticvault.dev` |
| Plugin Publisher | `sd0xdev` | `agenticvault` |

## Scope

| Scope | Description |
|-------|-------------|
| In | Domain 註冊、GitHub org 建立 + repo 轉移、npm scope 遷移、所有程式碼/文件 namespace 更新 |
| Out | 功能變更、新 protocol 支援、npm publish 本身（屬 v1-release） |

## Related Files

| Category | Files | Changes |
|----------|-------|---------|
| package.json | `package.json`, `packages/openclaw-plugin/package.json` | `name`, `repository`, `bugs`, `homepage`, `peerDependencies` |
| Source imports | `src/index.ts`, `src/agentic/index.ts`, `src/agentic/policy/types.ts`, `src/agentic/policy/engine.ts` | `@sd0xdev` → `@agenticvault` |
| OpenClaw imports | `packages/openclaw-plugin/src/context.ts`, `packages/openclaw-plugin/src/tools.ts` | `@sd0xdev/agentic-vault` → `@agenticvault/agentic-vault` |
| CI workflows | `.github/workflows/ci.yml`, `.github/workflows/openclaw-ci.yml`, `.github/workflows/release-openclaw.yml` | `--filter` package names |
| Config | `.mcp.json.example`, `.claude-plugin/plugin.json` | package name, publisher |
| Docs | `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` | All references |
| ADR | `docs/project/adrs/ADR-001-architecture-decisions.md` | Naming decision update |
| Request docs | `docs/features/*/requests/*.md` | Package name references |
| Lock file | `pnpm-lock.yaml` | Regenerate |

## Acceptance Criteria

### Phase 1: External Provisioning
- [x] `agenticvault.dev` domain 已註冊
- [x] GitHub `agenticvault` org 已建立
- [ ] Repo 已轉移至 `agenticvault/agentic-vault`
- [x] npm `agenticvault` org 已建立（Free plan）
- [x] `security@agenticvault.dev` email forwarding 已設定

### Phase 2: Code Rename
- [x] `package.json` name: `@agenticvault/agentic-vault`
- [x] `packages/openclaw-plugin/package.json` name: `@agenticvault/openclaw`
- [x] 所有 `@sd0xdev` source imports 已更新（grep `src/` + `packages/` 驗證零殘留）
- [x] 所有 `sd0xdev/agentic-vault-wallet` URL 已更新
- [x] `SECURITY.md` email 已更新至 `security@agenticvault.dev`
- [x] `.claude-plugin/plugin.json` publisher 已更新
- [x] `pnpm-lock.yaml` 已重建

### Phase 3: Verify
- [x] `pnpm typecheck` 通過
- [x] `pnpm lint` 通過
- [x] `pnpm test:unit` 通過（529 + 33 tests）
- [x] `pnpm build` 成功
- [ ] `pnpm pack --dry-run` 兩個套件內容正確

### Defensive (Optional)
- [ ] `agentic-vault.dev` 已註冊（redirect）
- [ ] `agenticvault.io` 已註冊（redirect）

## Dependencies

- Open-Source Readiness ([2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md)) — Done
- External: Domain registrar access, GitHub admin, npm admin

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| 外部消費者中斷 | **None** | v0.1.0 未發佈，零消費者 |
| 部分遷移遺漏 | **Medium** | Atomic commit + `grep -r "sd0xdev"` 驗證 |
| Coinbase 命名衝突 | **Low** | "Vault" ≠ "Wallet"，不同產品類別 |
| Domain 不可用 | ~~Low~~ **Done** | `agenticvault.dev` 已註冊 ✅ |
| npm scope 不可用 | ~~Low~~ **Done** | `@agenticvault` npm org 已建立 ✅ |

## Implementation Priority

| Sub-phase | Priority | Effort | Value |
|-----------|----------|--------|-------|
| P1-P5 External provisioning | #1 | Low（手動操作） | 前置條件 |
| C1-C8 Code rename | #2 | Medium（37 files） | 核心遷移 |
| V1-V2 Verify | #3 | Low | 品質確認 |

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | Done | Brainstorming Nash Equilibrium |
| Development | Done | Phase 2 code rename 完成，Codex review ✅ |
| Testing | Done | 562 tests pass (529+33), typecheck/lint/build clean |
| Acceptance | Partial | Phase 1 剩 repo transfer；Phase 2/3 code rename 已完成 |

## References

- Brainstorming: `/codex-brainstorm` domain + npm scope session (Codex thread: `019c60a2-1d8d-7ff2-9196-7ae54a932297`)
- npm Scope Docs: https://docs.npmjs.com/about-scopes/
- npm Organization: https://docs.npmjs.com/creating-an-organization/
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- v0.1.0 Release: [2026-02-12-v1-release.md](./2026-02-12-v1-release.md)
- Open-Source Readiness: [2026-02-15-open-source-readiness.md](./2026-02-15-open-source-readiness.md)
