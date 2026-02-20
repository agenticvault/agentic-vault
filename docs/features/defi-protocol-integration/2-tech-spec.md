# DeFi Protocol Integration — Technical Specification

> Based on [Feasibility Study](./0-feasibility-study.md) — Solution C (Hybrid: viem-native wallet + external DeFi router)
> Architecture updated per interface-agnostic brainstorm (2026-02-13)

This document has been split into multiple files for maintainability. See the full specification in the [`2-tech-spec/`](./2-tech-spec/) folder.

## Document Index

| # | File | Sections | Content |
|---|------|----------|---------|
| 0 | [Overview](./2-tech-spec/0-overview.md) | 1–2 | Overview, Architecture, Trust Boundary |
| 1 | [Type Definitions](./2-tech-spec/1-type-definitions.md) | 3 | DecodedIntent, Contract Registry, Policy V2 |
| 2 | [Module Specifications](./2-tech-spec/2-module-specs.md) | 4–5 | Decoders, Dispatcher, Policy Engine, MCP Tools, Workflows, CLI |
| 3 | [Diagrams, Testing & Security](./2-tech-spec/3-diagrams-testing-security.md) | 6–8 | Sequence Diagrams, Test Plan, Security |
| 4 | [Migration Phases 1–7](./2-tech-spec/4-migration-phases-1-7.md) | 9 (1–7) | Core protocol migration |
| 5 | [OpenClaw Plugin](./2-tech-spec/5-openclaw-plugin.md) | 4.10–4.11, Phase 8 | Plugin architecture & implementation |
| 6 | [Migration Phases 9–10](./2-tech-spec/6-migration-phases-9-10.md) | 9 (9–10) | Onboarding, Multi-Chain RPC |
| 7 | [Decisions](./2-tech-spec/7-decisions.md) | 10–11 | Deferred & Open Decisions |
