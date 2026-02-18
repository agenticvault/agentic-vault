<!-- Source: packages/openclaw-plugin/README.md | Commit: 9d69f83 | Last synced: 2026-02-17 -->

# @agenticvault/openclaw

[English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md)

[Agentic Vault](https://github.com/agenticvault/agentic-vault) 的 OpenClaw 插件 -- 将服务器端 EVM 签名暴露为 OpenClaw 代理工具，搭配默认拒绝的策略引擎。

## 安装

```bash
npm install @agenticvault/openclaw @agenticvault/agentic-vault
```

## 配置

在 OpenClaw 代理配置中注册插件：

```json
{
  "plugins": {
    "agentic-vault": {
      "package": "@agenticvault/openclaw",
      "config": {
        "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
        "region": "us-east-1",
        "policyConfigPath": "./policy.json",
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
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

## 安全性

- **默认拒绝** -- 所有签名操作皆需明确的策略批准
- **失败关闭** -- 未知 calldata 一律拒绝
- **双重闸控原始签名** -- `vault_sign_transaction` 与 `vault_sign_typed_data` 默认禁用；启用需在插件配置中设置 `enableUnsafeRawSign: true`
- **审计追踪** -- 每次操作皆以结构化 JSON 记录

## 策略配置

请参阅主项目的[策略配置文档](https://github.com/agenticvault/agentic-vault#configuration)与 [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) 获取完整示例。

## 许可证

[MIT](LICENSE)
