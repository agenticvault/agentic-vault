# ADR-001 Architecture Decisions

> **建立日期**: 2026-02-12
> **狀態**: Accepted
> **來源**: [可行性研究](../0-feasibility-study.md)

## Context

Agentic Vault Wallet 由既有 `@sd0xdev/vaultsign` v0.2.0 提取為獨立專案，新增 agentic 能力（MCP server、Claude Code plugin、OpenClaw plugin）。本文件記錄核心架構決策，作為後續開發基礎。

### 現有架構概況

| 項目 | 值 |
|------|-----|
| 原始碼 | 5 files, ~350 LOC |
| 核心介面 | `SignerAdapter`（`getAddress`, `signTransaction`, `signTypedData`, `healthCheck`） |
| Provider | AWS KMS only |
| 依賴 | `@aws-sdk/client-kms`, `viem` |

### 市場定位

| 產品 | 類型 | 差異點 |
|------|------|--------|
| Coinbase Agentic Wallets | SaaS | x402 protocol, enclave isolation |
| Privy | SaaS | Policy controls, server-side keys |
| Openfort | SaaS + OSS | OpenSigner self-hostable |
| Tether WDK | OSS | Multi-chain, self-custodial |
| **Agentic Vault (ours)** | **OSS** | **Server-side signing + MCP + plugin SDK** |

> 市場目前無純 OSS server-side signing + agentic plugin SDK 組合。

---

## Decision 1: Repo 策略與命名

**狀態**: Accepted

### 決策內容

| 項目 | 決策 |
|------|------|
| GitHub Repo | `sd0xdev/agentic-vault-wallet` |
| npm 套件名稱 | `@sd0xdev/agentic-vault` |
| 產品名稱 | Agentic Vault Wallet |
| 提取方式 | 從 monorepo `packages/vaultsign/` 複製至新 repo |

### 為何選擇 `@sd0xdev` 而非 `@agentic-vault`

| 考量 | `@sd0xdev` | `@agentic-vault` |
|------|------------|-------------------|
| npm scope 註冊 | 已持有 | 需另外申請 |
| 品牌一致性 | 與既有 `@sd0xdev/vaultsign` 一致 | 全新 scope |
| 棄用遷移 | `@sd0xdev/vaultsign` -> `@sd0xdev/agentic-vault`，同 scope 遷移順暢 | 跨 scope 遷移，使用者負擔較高 |
| 未來擴充 | 統一管理所有套件 | 僅限此專案 |

### Consequences

- 正面：維持既有 npm scope 生態，降低遷移成本
- 負面：產品名稱與 scope 不完全吻合（`agentic-vault-wallet` vs `@sd0xdev`）
- 風險：無顯著風險

---

## Decision 2: 套件拆分策略

**狀態**: Accepted

### 決策內容

| 項目 | 決策 |
|------|------|
| 初始佈局 | 單一套件（core + AWS provider），可選 `packages/mcp` |
| Agentic 程式碼位置 | `src/agentic/` 內部模組 |
| 信任邊界 | `SignerAdapter` 介面 + ESLint restricted-paths |

### 拆分觸發條件

滿足以下**任一條件**時，啟動套件拆分：

| # | 觸發條件 | 說明 |
|---|----------|------|
| 1 | 第二個 provider 帶重型依賴 | 例如新增 GCP KMS provider 且引入大量 `@google-cloud/*` 依賴，避免未使用該 provider 的使用者被迫安裝 |
| 2 | Plugin runtime 需獨立發佈 | Plugin 系統需與 core 分開發佈週期 |
| 3 | 不同 semver 節奏 | Core 與 agentic 模組的版本演進速度不一致 |

### Consequences

- 正面：初期維持簡單結構，降低維護成本
- 負面：若過晚拆分，可能累積技術債
- 緩解：透過 `SignerAdapter` 介面與 ESLint restricted-paths 預先建立模組邊界

---

## Decision 3: MCP 策略模型

**狀態**: Accepted

### 決策內容

採用 **policy-constrained tools** 模型，而非直接暴露原始簽名能力。

### 工具分類

| 工具 | 預設狀態 | 說明 |
|------|----------|------|
| `sign_swap` | Enabled | 策略約束：限定 DEX router 合約、滑點上限 |
| `sign_permit` | Enabled | 策略約束：限定 spender、金額上限、deadline |
| `sign_transaction` | **Disabled** | 原始交易簽名，風險較高 |
| `sign_typed_data` | **Disabled** | 原始 EIP-712 簽名，風險較高 |

### 原始簽名啟用方式

| 項目 | 值 |
|------|-----|
| 啟用旗標 | `--unsafe-raw-sign` |
| 命名慣例 | `unsafe` 前綴明確標示風險 |
| 預設行為 | 關閉，需使用者明確啟用 |

### 策略約束白名單

| 約束維度 | 說明 |
|----------|------|
| `chainId` | 限定允許的鏈 ID |
| 合約地址 | 限定可互動的合約 |
| Function selector | 限定可呼叫的函式 |
| 金額上限 | 單筆交易金額限制 |
| Deadline | 簽名有效期限 |

### Consequences

- 正面：大幅降低 AI agent 誤操作造成資產損失的風險
- 負面：需為每種操作設計專屬工具，初期開發成本較高
- 緩解：`--unsafe-raw-sign` 作為進階使用者的逃生艙

---

## Decision 4: OpenClaw 整合策略

**狀態**: Accepted

### 決策內容

| Phase | 決策 | 原因 |
|-------|------|------|
| Phase 1 | **不支援** OpenClaw | 2026/02 惡意 plugin 危機，安全風險過高 |
| Phase 2 | 有條件支援 | 需滿足下列全部條件 |

### Phase 2 啟用條件

| # | 條件 | 說明 |
|---|------|------|
| 1 | Verified publisher | OpenClaw 需提供發佈者身份驗證機制 |
| 2 | 最小權限 | Plugin 僅獲取完成功能所需的最小權限 |
| 3 | Kill switch | 可即時停用任何 plugin |
| 4 | 獨立安全審查 | 第三方安全稽核通過 |

### Consequences

- 正面：避免在生態系安全機制不成熟時引入風險
- 負面：Phase 1 缺少 OpenClaw 生態系整合，可能影響早期採用
- 緩解：Phase 1 專注 Claude Code plugin 與 MCP server，仍具 agentic 能力

---

## Decision 5: 安全基線

**狀態**: Accepted

### Phase 1 — 本地端安全

| 防護措施 | 說明 |
|----------|------|
| 金鑰隔離 | 私鑰永遠不進入 plugin 執行環境 |
| 工具白名單 | 僅允許已註冊的工具執行簽名 |
| 稽核日誌 | 所有簽名操作留存完整日誌 |
| 釘選 plugin | Plugin 版本固定，禁止自動更新 |
| 禁止自動安裝 | 不支援執行時期自動安裝 plugin |

### Phase 2 — 遠端安全

| 防護措施 | 說明 |
|----------|------|
| OAuth 2.1 | 採用最新 OAuth 規範 |
| PKCE | Proof Key for Code Exchange，防止授權碼攔截 |
| Audience 驗證 | 驗證 token 接收方身份 |
| SSRF 防護 | 阻止 server-side request forgery 攻擊 |

### Consequences

- 正面：Phase 1 即具備生產環境等級的本地安全防護
- 負面：嚴格安全要求可能增加開發與整合成本
- 緩解：分階段實施，Phase 1 聚焦本地端，Phase 2 擴展至遠端

---

## 歧見紀錄

記錄可行性研究中 Claude 與 Codex 的主要分歧及最終決議：

| 議題 | Claude 主張 | Codex 主張 | 最終決議 |
|------|-------------|------------|----------|
| 初始套件數量 | 1 個 | 5 個 | **1-2 個** |
| npm scope | `@sd0xdev` | `@agentic-vault` | **`@sd0xdev`** |
| 棄用過渡期 | 立即 | 90 天 | **1-2 個版本** |
| Phase 1 安全深度 | 輕量 | 企業級 | **嚴格但限本地端** |
| MCP 工具設計 | 原始暴露 | 策略管控 | **策略管控** |

---

## References

- [可行性研究](../0-feasibility-study.md)
- [Privy Agentic Wallets](https://docs.privy.io/recipes/wallets/agentic-wallets)
- [Coinbase Agentic Wallets](https://www.theblock.co/post/389524/coinbase-rolls-out-ai-tool-to-give-any-agent-a-wallet)
- [Openfort Agentic Finance](https://www.openfort.io/solutions/ai-agents)
- [OpenClaw Malicious Plugins](https://www.opensourceforu.com/2026/02/ai-assistant-openclaw-hosts-hundreds-of-crypto-stealing-malicious-plugins/)
