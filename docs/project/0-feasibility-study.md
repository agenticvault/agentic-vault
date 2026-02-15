# Agentic Vault Wallet — Feasibility Study

> **Created**: 2026-02-12
> **Method**: `/codex-brainstorm` adversarial debate (Claude vs Codex, 3 rounds)
> **Status**: Nash Equilibrium Reached
> **Thread ID**: `019c524a-b20c-79d2-b7f8-fc80f148bff1`

## Background

將現有 `@sd0xdev/vaultsign` v0.2.0 開源為獨立專案，改名為 Agentic Vault Wallet，新增 agentic 能力（MCP server、Claude Code plugin、OpenClaw plugin）。

### 現有 vaultsign 概況

| 項目 | 值 |
|------|-----|
| 原始碼 | 5 files, ~350 LOC |
| 核心介面 | `SignerAdapter`（`getAddress`, `signTransaction`, `signTypedData`, `healthCheck`） |
| Provider | AWS KMS only（`KmsSignerAdapter` + `AwsKmsClient`） |
| 依賴 | `@aws-sdk/client-kms`, `viem` |
| 授權 | MIT |
| 測試 | Unit (60 tests) + Integration |

### 市場背景

| 產品 | 類型 | 特色 |
|------|------|------|
| Coinbase Agentic Wallets | SaaS | x402 protocol, enclave isolation |
| Privy | SaaS | Policy controls, server-side keys |
| Openfort | SaaS + OSS | OpenSigner self-hostable |
| Tether WDK | OSS | Multi-chain, self-custodial |
| **Agentic Vault (ours)** | **OSS** | **Server-side signing + MCP + plugin SDK** |

> 目前市場無純 OSS server-side signing + agentic plugin SDK 的組合。

## 收斂決策

### Repo 策略

| 決策 | 值 |
|------|-----|
| Repo | `agenticvault/agentic-vault` |
| npm | `@agenticvault/agentic-vault` |
| 產品名稱 | Agentic Vault Wallet |
| 提取方式 | 從 `packages/vaultsign/` 複製 + 新 repo |

### 套件架構

| 決策 | 值 |
|------|-----|
| 初始佈局 | 單一套件（core + AWS provider），可選 `packages/mcp` |
| Agentic 程式碼 | `src/agentic/` 內部模組 |
| 信任邊界 | `SignerAdapter` 介面 + ESLint restricted-paths |
| 拆分觸發條件 | (1) 第二個 provider 帶重型依賴 (2) plugin runtime 需獨立發佈 (3) 不同 semver 節奏 |

### 安全架構

| Phase | 防護措施 |
|-------|----------|
| Phase 1（本地端） | 金鑰永遠不進 plugin、工具白名單、稽核日誌、釘選 plugin、禁止自動安裝 |
| Phase 1 MCP | 策略約束工具（`sign_swap`、`sign_permit`）、原始簽名預設關閉（`--unsafe-raw-sign`） |
| Phase 1 MCP 防護 | chainId / 合約 / selector / 金額 / deadline 白名單 |
| Phase 2（遠端） | OAuth2.1 + PKCE + audience 驗證 + SSRF 防護 |

### OpenClaw 策略

| Phase | 決策 |
|-------|------|
| Phase 1 | 不支援 — 2026/02 惡意 plugin 危機 |
| Phase 2 | 需 verified publisher + 最小權限 + kill switch + 獨立安全審查 |

## 歧見紀錄

| 議題 | Claude | Codex | 決議 |
|------|--------|-------|------|
| 初始套件數量 | 1 個 | 5 個 | **1-2 個** |
| npm scope | `@sd0xdev` | `@agentic-vault` | **`@sd0xdev`** |
| 棄用過渡期 | 立即 | 90 天 | **1-2 個版本** |
| Phase 1 安全深度 | 輕量 | 企業級 | **嚴格但本地端** |
| MCP 工具設計 | 原始暴露 | 策略管控 | **策略管控** |

## References

- [Privy Agentic Wallets](https://docs.privy.io/recipes/wallets/agentic-wallets)
- [Coinbase Agentic Wallets](https://www.theblock.co/post/389524/coinbase-rolls-out-ai-tool-to-give-any-agent-a-wallet)
- [Openfort Agentic Finance](https://www.openfort.io/solutions/ai-agents)
- [OpenClaw Malicious Plugins](https://www.opensourceforu.com/2026/02/ai-assistant-openclaw-hosts-hundreds-of-crypto-stealing-malicious-plugins/)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
