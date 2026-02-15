# ADR-001 Architecture Decisions

> **Created**: 2026-02-12
> **Status**: ✅ Done
> **Priority**: P0
> **Feature**: agentic-vault
> **Feasibility Study**: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)

## Background

記錄 Agentic Vault Wallet 的核心架構決策，包括 repo 策略、命名、套件拆分觸發條件、安全基線、MCP 策略模型。此為所有後續工作的基礎文件。

## Requirements

- 撰寫 ADR-001 markdown 文件
- 涵蓋：repo/package 命名、拆分觸發條件、OpenClaw 時程、安全基線、MCP 策略模型
- 格式遵循 ADR（Architecture Decision Record）標準

## Scope

| Scope | Description |
|-------|-------------|
| In | ADR 文件撰寫 |
| Out | 程式碼實作 |

## Acceptance Criteria

- [x] ADR-001 涵蓋 repo 策略（`agenticvault/agentic-vault`）
- [x] ADR-001 涵蓋 npm 命名（`@agenticvault/agentic-vault`）
- [x] ADR-001 涵蓋套件拆分觸發條件（3 conditions）
- [x] ADR-001 涵蓋 MCP 策略模型（policy-constrained tools）
- [x] ADR-001 涵蓋 OpenClaw Phase 2 條件
- [x] ADR-001 涵蓋安全基線（Phase 1 + Phase 2）

## Dependencies

- Feasibility study (Done)

## Progress

| Phase | Status | Note |
|-------|--------|------|
| Analysis | ✅ Done | Feasibility study completed |
| Development | ✅ Done | ADR-001 written |
| Acceptance | ✅ Done | All criteria met |

## References

- Feasibility Study: [../../../project/0-feasibility-study.md](../../../project/0-feasibility-study.md)
