# CI Pipeline

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P1
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
> **Depends on**: [2026-02-12-package-layout.md](./2026-02-12-package-layout.md)

## Background

在新 repo 建立 CI pipeline：typecheck、test、lint、npm provenance/attestation。確保發佈的 npm 套件具有可驗證的出處。

## Requirements

- GitHub Actions workflow
- 步驟：install → typecheck → lint → test:unit → test:integration
- npm publish with provenance（`--provenance`）
- Release workflow（semver tag → publish）

## Scope

| Scope | Description |
|-------|-------------|
| In | CI/CD 設定、npm provenance |
| Out | 程式碼開發 |

## Acceptance Criteria

- [x] CI workflow 在 push/PR 時自動執行
- [x] typecheck + lint + test:unit 通過
- [x] npm publish 使用 `--provenance` flag
- [x] Release workflow 由 semver tag 觸發
- [x] npm 套件包含 attestation 資訊

## Dependencies

- Package Layout (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | CI + release workflows |
| Testing | ✅ Done | Workflow validated |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
