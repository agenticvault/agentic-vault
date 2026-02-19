<!-- Source: packages/openclaw-plugin/README.md | Last synced: 2026-02-19 -->

# @agenticvault/openclaw

[English](README.md) | 繁體中文 | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[Agentic Vault](https://github.com/agenticvault/agentic-vault) 的 OpenClaw 插件 -- 將伺服器端 EVM 簽章暴露為 OpenClaw 代理工具，搭配預設拒絕的策略引擎。

## 安裝

### 透過 OpenClaw 主機設定（推薦）

安裝套件及其 peer dependency，然後在 OpenClaw 主機設定中註冊：

```bash
npm install @agenticvault/openclaw openclaw
```

### 透過 `plugins.load.paths`（手動）

若偏好明確控制插件載入，可將套件安裝至本地目錄，再將路徑指定給 OpenClaw：

```bash
# 安裝至本地目錄
mkdir -p ./openclaw-plugins
cd ./openclaw-plugins
npm install @agenticvault/openclaw
```

然後在 OpenClaw 主機設定中新增路徑：

```json
{
  "plugins": {
    "load": {
      "paths": ["./openclaw-plugins/node_modules/@agenticvault/openclaw"]
    }
  }
}
```

> **建議**：正式環境請固定版本（`npm install @agenticvault/openclaw@0.1.1`），避免意外升級。

> **已知限制**：`openclaw plugins install @agenticvault/openclaw` 可能遇到 installer ID 不符的問題。在上游修復前，請使用上述方式安裝。

## 設定

在 OpenClaw 主機設定中註冊插件。entries key 必須與 manifest `id`（`"agentic-vault"`）一致：

```json
{
  "plugins": {
    "entries": {
      "agentic-vault": {
        "config": {
          "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
          "region": "us-east-1",
          "policyConfigPath": "./policy.json",
          "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
        }
      }
    }
  }
}
```

| 選項 | 必要 | 說明 |
|------|------|------|
| `keyId` | 是 | AWS KMS 金鑰 ARN |
| `region` | 是 | AWS 區域 |
| `policyConfigPath` | 否 | 策略 JSON 檔案路徑（未指定時預設全部拒絕） |
| `rpcUrl` | 否 | 餘額/轉帳工具的 RPC 端點。使用 `vault_get_balance`、`vault_send_transfer`、`vault_send_erc20_transfer` 時必要。 |
| `expectedAddress` | 否 | 用於驗證的預期錢包地址 |
| `enableUnsafeRawSign` | 否 | 啟用原始簽署工具（預設：`false`） |

## 可用工具

### 安全工具（預設啟用）

| 工具 | 說明 |
|------|------|
| `vault_get_address` | 取得此保險庫管理的錢包地址 |
| `vault_health_check` | 檢查保險庫簽署器的健康狀態 |
| `vault_sign_defi_call` | 在 calldata 解碼與策略驗證後簽署 DeFi 合約互動 |
| `vault_sign_permit` | 在策略驗證後簽署 EIP-2612 permit |
| `vault_get_balance` | 查詢原生代幣或 ERC20 代幣餘額（需要 `rpcUrl`） |
| `vault_send_transfer` | 發送原生 ETH 轉帳，含策略驗證（需要 `rpcUrl`） |
| `vault_send_erc20_transfer` | 發送 ERC20 代幣轉帳，含策略驗證（需要 `rpcUrl`） |

### 雙重閘控工具（需要 `enableUnsafeRawSign: true`）

| 工具 | 說明 |
|------|------|
| `vault_sign_transaction` | 簽署原始 EVM 交易（繞過解碼管線） |
| `vault_sign_typed_data` | 簽署原始 EIP-712 型別化資料（繞過解碼管線） |

## 從預發布 API 遷移

插件進入點從預發布的 `register(api, config)` 變更為官方 SDK 合約 `export default function(api)`：

| 之前（預發布） | 之後（目前） |
|----------------|-------------|
| `import { register } from "@agenticvault/openclaw"` | `export default function(api)` |
| `register(api, config)` | 設定從 `api.pluginConfig` 讀取 |
| `api.registerTool(name, config, handler)` | `api.registerTool({ name, description, parameters, label, execute })` |

插件現在使用官方 `openclaw/plugin-sdk` 型別，並可透過 `package.json` 中的 `openclaw` 欄位被 OpenClaw 閘道發現。

## 安全性

- **預設拒絕** -- 所有簽署操作皆需明確的策略核准
- **失敗關閉** -- 未知 calldata 一律拒絕
- **雙重閘控原始簽署** -- `vault_sign_transaction` 與 `vault_sign_typed_data` 預設停用；啟用需在插件設定中指定 `enableUnsafeRawSign: true`
- **稽核軌跡** -- 每次操作皆以結構化 JSON 記錄

## 策略設定

請參閱主專案的[策略設定文件](https://github.com/agenticvault/agentic-vault#configuration)與 [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) 取得完整範例。

## 授權

[MIT](LICENSE)
