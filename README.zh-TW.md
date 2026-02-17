<!-- Source: README.md | Commit: 96a8dcc | Last synced: 2026-02-16 -->

# Agentic Vault

[![npm version](https://img.shields.io/npm/v/@agenticvault/agentic-vault)](https://www.npmjs.com/package/@agenticvault/agentic-vault)
[![CI](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | 繁體中文 | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

以 AWS KMS 進行伺服器端 EVM 簽章，內建 DeFi 協議解析。透過 MCP、CLI 或 OpenClaw 將錢包暴露給 AI 代理，搭配預設拒絕的策略引擎與完整稽核日誌。

## 為什麼選擇 Agentic Vault

AI 代理需要簽署區塊鏈交易，但直接給予私鑰非常危險。Agentic Vault 將金鑰保存在 AWS KMS（HSM）中，並提供策略引擎限制代理可簽署的操作範圍。代理只看到高階工具（`sign_swap`、`sign_permit`），私鑰永遠不會離開硬體。

## 特色

- **HSM 安全簽章** -- 私鑰永遠不離開 AWS KMS，僅傳送摘要進行簽署
- **DeFi 協議感知** -- 支援 ERC-20、Uniswap V3、Aave V3 的 calldata 解碼與協議專屬策略規則
- **預設拒絕策略引擎** -- 鏈 ID、合約、選擇器、金額、期限及協議層級約束
- **多種介面** -- 可作為 TypeScript 函式庫、CLI、MCP 伺服器或 OpenClaw 插件使用
- **稽核日誌** -- 每次簽署操作（核准、拒絕、錯誤）皆有結構化 JSON 稽核紀錄
- **EVM 原生** -- 基於 [viem](https://viem.sh) 建構，完整支援 EIP-712 型別化資料

## 快速開始

```bash
npm install @agenticvault/agentic-vault
```

```typescript
import { createSigningProvider, EvmSignerAdapter } from '@agenticvault/agentic-vault';

const provider = createSigningProvider({
  provider: 'aws-kms',
  keyId: 'arn:aws:kms:us-east-1:123456789:key/your-key-id',
  region: 'us-east-1',
});

const signer = new EvmSignerAdapter(provider);
const address = await signer.getAddress();
```

無需 AWS 的快速測試，可使用 `dry-run` 模式（僅解碼 + 策略檢查，不簽署）：

```bash
npx agentic-vault dry-run --chain-id 1 --to 0xa0b869... --data 0x095ea7b3...
```

金鑰建立與 IAM 設定請參閱 [AWS KMS 設定指南](docs/guides/aws-kms-setup.md)。

## 介面

| 介面 | 使用情境 | 需要 AWS |
|------|----------|:---:|
| TypeScript 函式庫 | 將簽署功能嵌入應用程式 | 是 |
| CLI | 命令列簽署 + 模擬執行 | 部分 |
| MCP 伺服器 | 將錢包暴露給 AI 代理（Claude 等） | 是 |
| OpenClaw 插件 | 作為 OpenClaw 代理工具使用 | 是 |

使用範例與設定請參閱[介面指南](docs/guides/interfaces.md)。

## 支援的協議

| 協議 | 操作 | 解碼器 | 策略評估器 |
|------|------|:---:|:---:|
| ERC-20 | `approve`、`transfer` | 有 | 有（授權上限、spender 白名單） |
| Uniswap V3 | `exactInputSingle` | 有 | 有（代幣對、滑點、接收者） |
| Aave V3 | `supply`、`borrow`、`repay`、`withdraw` | 有 | 有（資產白名單、利率模式） |

未知 calldata 一律拒絕（失敗關閉）。Dispatcher 使用兩階段解析：先依合約地址，再依選擇器回退（如 ERC-20）。

## 設定

策略引擎使用 JSON 設定檔。未提供設定檔時，所有受策略管控的簽署操作皆被拒絕（預設拒絕）。

完整結構與範例請參閱[策略參考文件](docs/reference/policy.md)，或從 [`policy.example.json`](policy.example.json) 開始。

## 安全模型

### 信任邊界

```
 AI 代理（Claude / MCP Client / OpenClaw）
          |
          | MCP Protocol / OpenClaw Plugin API
          v
 +------------------------------------+
 |   Agentic Vault                    |
 |  +-----------+ +--------+ +-----+ |
 |  | Protocol  | | Policy | | Audit| |
 |  | Dispatcher| | Engine | | Sink | |
 |  +-----------+ +--------+ +-----+ |
 |          |                         |
 |  +--------------------+           |
 |  | EvmSignerAdapter   |           |
 |  +--------------------+           |
 +-----------|------------------------+
             | 僅傳送摘要
             v
 +------------------------------------+
 |       AWS KMS (HSM)                |
 |   私鑰永遠不離開                     |
 +------------------------------------+
```

### 核心原則

| 原則 | 說明 |
|------|------|
| 金鑰隔離 | 私鑰保留在 HSM 中，僅傳送 32 位元摘要進行簽署 |
| 預設拒絕 | 策略引擎拒絕所有未明確允許的請求 |
| 失敗關閉 | 未知 calldata 一律拒絕；已知協議但無評估器也拒絕 |
| 稽核軌跡 | 每次操作以結構化 JSON 記錄至 stderr，含呼叫者標記 |
| 最小暴露面 | 原始簽署工具（`sign_transaction`、`sign_typed_data`）預設停用 |

## Claude Code 插件

4 個技能透過 MCP 工具與錢包互動，絕不直接存取金鑰。

| 技能 | 說明 |
|------|------|
| `sign-swap` | 協調 swap 簽署操作 |
| `sign-permit` | 協調 EIP-2612 permit 簽署 |
| `check-wallet` | 檢查錢包地址與健康狀態 |
| `audit-log` | 查詢稽核日誌 |

## 套件匯出

| 子路徑 | 內容 | MCP 依賴 |
|--------|------|:-:|
| `@agenticvault/agentic-vault` | 核心簽署（SigningProvider、EvmSignerAdapter、factory） | 無 |
| `@agenticvault/agentic-vault/protocols` | 協議解碼器、dispatcher、PolicyEngine V2、workflows | 無 |
| `@agenticvault/agentic-vault/agentic` | MCP 伺服器、稽核日誌記錄器 | 有 |

## 文件

| 文件 | 說明 |
|------|------|
| [介面指南](docs/guides/interfaces.md) | TypeScript、CLI、MCP、OpenClaw 使用方式 |
| [策略參考](docs/reference/policy.md) | 策略 JSON 結構、欄位與範例 |
| [AWS KMS 設定](docs/guides/aws-kms-setup.md) | 金鑰建立、IAM 策略、驗證方式 |
| [OpenClaw 插件](packages/openclaw-plugin/) | OpenClaw 插件套件與設定 |
| [架構決策](docs/project/adrs/ADR-001-architecture-decisions.md) | 關鍵設計決策的 ADR |
| [貢獻指南](CONTRIBUTING.md) | 開發流程與規範 |

## 路線圖

- 更多簽署提供者（GCP KMS、HashiCorp Vault）
- 更多協議解碼器（Curve、Compound V3）
- 多重簽章支援
- 遠端 MCP 伺服器模式（HTTP 傳輸 + OAuth 2.1）

## 貢獻

請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 了解開發流程、分支命名與提交規範。

本專案遵循 [Contributor Covenant 行為準則](CODE_OF_CONDUCT.md)。

## 授權

[MIT](LICENSE)
