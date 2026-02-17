<!-- Source: README.md | Commit: 96a8dcc | Last synced: 2026-02-16 -->

# Agentic Vault

[![npm version](https://img.shields.io/npm/v/@agenticvault/agentic-vault)](https://www.npmjs.com/package/@agenticvault/agentic-vault)
[![CI](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md)

基于 AWS KMS 的服务器端 EVM 签名，内建 DeFi 协议解析。通过 MCP、CLI 或 OpenClaw 将钱包暴露给 AI 代理，搭配默认拒绝的策略引擎与完整审计日志。

## 为什么选择 Agentic Vault

AI 代理需要签署区块链交易，但直接给予私钥非常危险。Agentic Vault 将密钥保存在 AWS KMS（HSM）中，并提供策略引擎限制代理可签署的操作范围。代理只看到高级工具（`sign_swap`、`sign_permit`），私钥永远不会离开硬件。

## 特性

- **HSM 安全签名** -- 私钥永远不离开 AWS KMS，仅传送摘要进行签署
- **DeFi 协议感知** -- 支持 ERC-20、Uniswap V3、Aave V3 的 calldata 解码与协议专属策略规则
- **默认拒绝策略引擎** -- 链 ID、合约、选择器、金额、期限及协议层级约束
- **多种接口** -- 可作为 TypeScript 库、CLI、MCP 服务器或 OpenClaw 插件使用
- **审计日志** -- 每次签名操作（批准、拒绝、错误）皆有结构化 JSON 审计记录
- **EVM 原生** -- 基于 [viem](https://viem.sh) 构建，完整支持 EIP-712 类型化数据

## 快速开始

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

无需 AWS 的快速测试，可使用 `dry-run` 模式（仅解码 + 策略检查，不签名）：

```bash
npx agentic-vault dry-run --chain-id 1 --to 0xa0b869... --data 0x095ea7b3...
```

密钥创建与 IAM 配置请参阅 [AWS KMS 配置指南](docs/guides/aws-kms-setup.md)。

## 接口

| 接口 | 使用场景 | 需要 AWS |
|------|----------|:---:|
| TypeScript 库 | 将签名功能嵌入应用程序 | 是 |
| CLI | 命令行签名 + 模拟执行 | 部分 |
| MCP 服务器 | 将钱包暴露给 AI 代理（Claude 等） | 是 |
| OpenClaw 插件 | 作为 OpenClaw 代理工具使用 | 是 |

使用示例与配置请参阅[接口指南](docs/guides/interfaces.md)。

## 支持的协议

| 协议 | 操作 | 解码器 | 策略评估器 |
|------|------|:---:|:---:|
| ERC-20 | `approve`、`transfer` | 有 | 有（授权上限、spender 白名单） |
| Uniswap V3 | `exactInputSingle` | 有 | 有（代币对、滑点、接收者） |
| Aave V3 | `supply`、`borrow`、`repay`、`withdraw` | 有 | 有（资产白名单、利率模式） |

未知 calldata 一律拒绝（失败关闭）。Dispatcher 使用两阶段解析：先依合约地址，再依选择器回退（如 ERC-20）。

## 配置

策略引擎使用 JSON 配置文件。未提供配置文件时，所有受策略管控的签名操作皆被拒绝（默认拒绝）。

完整结构与示例请参阅[策略参考文档](docs/reference/policy.md)，或从 [`policy.example.json`](policy.example.json) 开始。

## 安全模型

### 信任边界

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
             | 仅传送摘要
             v
 +------------------------------------+
 |       AWS KMS (HSM)                |
 |   私钥永远不离开                     |
 +------------------------------------+
```

### 核心原则

| 原则 | 说明 |
|------|------|
| 密钥隔离 | 私钥保留在 HSM 中，仅传送 32 字节摘要进行签名 |
| 默认拒绝 | 策略引擎拒绝所有未明确允许的请求 |
| 失败关闭 | 未知 calldata 一律拒绝；已知协议但无评估器也拒绝 |
| 审计追踪 | 每次操作以结构化 JSON 记录至 stderr，含调用者标记 |
| 最小暴露面 | 原始签名工具（`sign_transaction`、`sign_typed_data`）默认禁用 |

## Claude Code 插件

4 个技能通过 MCP 工具与钱包交互，绝不直接访问密钥。

| 技能 | 说明 |
|------|------|
| `sign-swap` | 协调 swap 签名操作 |
| `sign-permit` | 协调 EIP-2612 permit 签名 |
| `check-wallet` | 检查钱包地址与健康状态 |
| `audit-log` | 查询审计日志 |

## 包导出

| 子路径 | 内容 | MCP 依赖 |
|--------|------|:-:|
| `@agenticvault/agentic-vault` | 核心签名（SigningProvider、EvmSignerAdapter、factory） | 无 |
| `@agenticvault/agentic-vault/protocols` | 协议解码器、dispatcher、PolicyEngine V2、workflows | 无 |
| `@agenticvault/agentic-vault/agentic` | MCP 服务器、审计日志记录器 | 有 |

## 文档

| 文档 | 说明 |
|------|------|
| [接口指南](docs/guides/interfaces.md) | TypeScript、CLI、MCP、OpenClaw 使用方式 |
| [策略参考](docs/reference/policy.md) | 策略 JSON 结构、字段与示例 |
| [AWS KMS 配置](docs/guides/aws-kms-setup.md) | 密钥创建、IAM 策略、认证方式 |
| [OpenClaw 插件](packages/openclaw-plugin/) | OpenClaw 插件包与配置 |
| [架构决策](docs/project/adrs/ADR-001-architecture-decisions.md) | 关键设计决策的 ADR |
| [贡献指南](CONTRIBUTING.md) | 开发流程与规范 |

## 路线图

- 更多签名提供者（GCP KMS、HashiCorp Vault）
- 更多协议解码器（Curve、Compound V3）
- 多重签名支持
- 远程 MCP 服务器模式（HTTP 传输 + OAuth 2.1）

## 贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程、分支命名与提交规范。

本项目遵循 [Contributor Covenant 行为准则](CODE_OF_CONDUCT.md)。

## 许可证

[MIT](LICENSE)
