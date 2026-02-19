<!-- Source: packages/openclaw-plugin/README.md | Last synced: 2026-02-19 -->

# @agenticvault/openclaw

[English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md)

[Agentic Vault](https://github.com/agenticvault/agentic-vault) 的 OpenClaw 插件 -- 将服务器端 EVM 签名暴露为 OpenClaw 代理工具，搭配默认拒绝的策略引擎。

## 安装

### 通过 OpenClaw 主机配置（推荐）

安装包及其 peer dependency，然后在 OpenClaw 主机配置中注册：

```bash
npm install @agenticvault/openclaw openclaw
```

### 通过 `plugins.load.paths`（手动）

如果偏好显式控制插件加载，可将包安装到本地目录，再将路径指定给 OpenClaw：

```bash
# 安装到本地目录
mkdir -p ./openclaw-plugins
cd ./openclaw-plugins
npm install @agenticvault/openclaw
```

然后在 OpenClaw 主机配置中添加路径：

```json
{
  "plugins": {
    "load": {
      "paths": ["./openclaw-plugins/node_modules/@agenticvault/openclaw"]
    }
  }
}
```

> **建议**：生产环境请固定版本（`npm install @agenticvault/openclaw@0.1.1`），避免意外升级。

> **已知限制**：`openclaw plugins install @agenticvault/openclaw` 可能遇到 installer ID 不匹配的问题。在上游修复前，请使用上述方式安装。

## 配置

在 OpenClaw 主机配置中注册插件。entries key 必须与 manifest `id`（`"agentic-vault"`）一致：

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

| 选项 | 必需 | 说明 |
|------|------|------|
| `keyId` | 是 | AWS KMS 密钥 ARN |
| `region` | 是 | AWS 区域 |
| `policyConfigPath` | 否 | 策略 JSON 文件路径（未指定时默认全部拒绝） |
| `rpcUrl` | 否 | 余额/转账工具的 RPC 端点。使用 `vault_get_balance`、`vault_send_transfer`、`vault_send_erc20_transfer` 时必需。 |
| `expectedAddress` | 否 | 用于验证的预期钱包地址 |
| `enableUnsafeRawSign` | 否 | 启用原始签名工具（默认：`false`） |

## 可用工具

### 安全工具（默认启用）

| 工具 | 说明 |
|------|------|
| `vault_get_address` | 获取此保险库管理的钱包地址 |
| `vault_health_check` | 检查保险库签名器的健康状态 |
| `vault_sign_defi_call` | 在 calldata 解码与策略验证后签署 DeFi 合约交互 |
| `vault_sign_permit` | 在策略验证后签署 EIP-2612 permit |
| `vault_get_balance` | 查询原生代币或 ERC20 代币余额（需要 `rpcUrl`） |
| `vault_send_transfer` | 发送原生 ETH 转账，含策略验证（需要 `rpcUrl`） |
| `vault_send_erc20_transfer` | 发送 ERC20 代币转账，含策略验证（需要 `rpcUrl`） |

### 双重闸控工具（需要 `enableUnsafeRawSign: true`）

| 工具 | 说明 |
|------|------|
| `vault_sign_transaction` | 签署原始 EVM 交易（绕过解码管线） |
| `vault_sign_typed_data` | 签署原始 EIP-712 类型化数据（绕过解码管线） |

## 从预发布 API 迁移

插件入口点从预发布的 `register(api, config)` 变更为官方 SDK 合约 `export default function(api)`：

| 之前（预发布） | 之后（当前） |
|----------------|-------------|
| `import { register } from "@agenticvault/openclaw"` | `export default function(api)` |
| `register(api, config)` | 配置从 `api.pluginConfig` 读取 |
| `api.registerTool(name, config, handler)` | `api.registerTool({ name, description, parameters, label, execute })` |

插件现在使用官方 `openclaw/plugin-sdk` 类型，并可通过 `package.json` 中的 `openclaw` 字段被 OpenClaw 网关发现。

## 安全性

- **默认拒绝** -- 所有签名操作皆需明确的策略批准
- **失败关闭** -- 未知 calldata 一律拒绝
- **双重闸控原始签名** -- `vault_sign_transaction` 与 `vault_sign_typed_data` 默认禁用；启用需在插件配置中设置 `enableUnsafeRawSign: true`
- **审计追踪** -- 每次操作皆以结构化 JSON 记录

## 策略配置

请参阅主项目的[策略配置文档](https://github.com/agenticvault/agentic-vault#configuration)与 [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) 获取完整示例。

## 许可证

[MIT](LICENSE)
