<!-- Source: README.md | Commit: 96a8dcc | Last synced: 2026-02-16 -->

# Agentic Vault

[![npm version](https://img.shields.io/npm/v/@agenticvault/agentic-vault)](https://www.npmjs.com/package/@agenticvault/agentic-vault)
[![CI](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | 日本語 | [한국어](README.ko.md)

AWS KMS によるサーバーサイド EVM 署名と、組み込みの DeFi プロトコル解析機能を提供します。MCP、CLI、または OpenClaw を通じてウォレットを AI エージェントに公開し、デフォルト拒否のポリシーエンジンと完全な監査ログを備えています。

## Agentic Vault を選ぶ理由

AI エージェントはブロックチェーントランザクションに署名する必要がありますが、秘密鍵を直接渡すのは危険です。Agentic Vault は鍵を AWS KMS（HSM）に保管し、エージェントが署名できる操作範囲を制限するポリシーエンジンを提供します。エージェントからは高レベルのツール（`sign_swap`、`sign_permit`）のみが見え、秘密鍵がハードウェアの外に出ることはありません。

## 特徴

- **HSM による安全な署名** -- 秘密鍵は AWS KMS の外に出ることはなく、署名にはダイジェストのみが送信されます
- **DeFi プロトコル対応** -- ERC-20、Uniswap V3、Aave V3 の calldata デコードとプロトコル固有のポリシールールに対応
- **デフォルト拒否ポリシーエンジン** -- チェーン ID、コントラクト、セレクター、金額、期限、およびプロトコルレベルの制約
- **複数のインターフェース** -- TypeScript ライブラリ、CLI、MCP サーバー、または OpenClaw プラグインとして使用可能
- **監査ログ** -- すべての署名操作（承認、拒否、エラー）の構造化 JSON 監査記録
- **EVM ネイティブ** -- [viem](https://viem.sh) をベースに構築、EIP-712 型付きデータを完全サポート

## クイックスタート

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

AWS 不要のクイックテストには `dry-run` モード（デコード + ポリシーチェックのみ、署名なし）をご利用ください：

```bash
npx agentic-vault dry-run --chain-id 1 --to 0xa0b869... --data 0x095ea7b3...
```

鍵の作成と IAM ポリシーの設定については [AWS KMS セットアップガイド](docs/guides/aws-kms-setup.md)をご覧ください。

## インターフェース

| インターフェース | ユースケース | AWS 必須 |
|-----------------|-------------|:---:|
| TypeScript ライブラリ | アプリケーションに署名機能を組み込む | はい |
| CLI | コマンドライン署名 + ドライラン | 一部 |
| MCP サーバー | AI エージェント（Claude など）にウォレットを公開 | はい |
| OpenClaw プラグイン | OpenClaw エージェントツールとして使用 | はい |

使用例と設定については[インターフェースガイド](docs/guides/interfaces.md)をご覧ください。

## 対応プロトコル

| プロトコル | アクション | デコーダー | ポリシー評価器 |
|-----------|-----------|:---:|:---:|
| ERC-20 | `approve`、`transfer` | あり | あり（承認上限、spender ホワイトリスト） |
| Uniswap V3 | `exactInputSingle` | あり | あり（トークンペア、スリッページ、受取人） |
| Aave V3 | `supply`、`borrow`、`repay`、`withdraw` | あり | あり（アセットホワイトリスト、金利モード） |

不明な calldata は常に拒否されます（フェイルクローズ）。Dispatcher は 2 段階の解決を使用します：まずコントラクトアドレス、次にセレクターベースのフォールバック（例：ERC-20）。

## 設定

ポリシーエンジンは JSON 設定ファイルを使用します。ポリシーファイルが未提供の場合、ポリシーで管理されるすべての署名操作は拒否されます（デフォルト拒否）。

完全なスキーマと例については[ポリシーリファレンス](docs/reference/policy.md)をご覧いただくか、[`policy.example.json`](policy.example.json) から始めてください。

## セキュリティモデル

### 信頼境界

```
 AI エージェント（Claude / MCP Client / OpenClaw）
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
             | ダイジェストのみ
             v
 +------------------------------------+
 |       AWS KMS (HSM)                |
 |   秘密鍵は外部に出ません            |
 +------------------------------------+
```

### 基本原則

| 原則 | 説明 |
|------|------|
| 鍵の隔離 | 秘密鍵は HSM 内に保持され、署名には 32 バイトのダイジェストのみが送信されます |
| デフォルト拒否 | ポリシーエンジンは明示的に許可されていないすべてのリクエストを拒否します |
| フェイルクローズ | 不明な calldata は常に拒否されます。既知のプロトコルでも評価器がなければ拒否されます |
| 監査証跡 | すべての操作は構造化 JSON として stderr に記録され、呼び出し元タグが付与されます |
| 最小限の攻撃面 | 生の署名ツール（`sign_transaction`、`sign_typed_data`）はデフォルトで無効です |

## Claude Code プラグイン

4 つのスキルが MCP ツールを通じてウォレットと連携します。鍵に直接アクセスすることはありません。

| スキル | 説明 |
|--------|------|
| `sign-swap` | スワップ署名操作のオーケストレーション |
| `sign-permit` | EIP-2612 permit 署名のオーケストレーション |
| `check-wallet` | ウォレットアドレスとヘルスステータスの確認 |
| `audit-log` | 監査ログのクエリ |

## パッケージエクスポート

| サブパス | 内容 | MCP 依存 |
|---------|------|:-:|
| `@agenticvault/agentic-vault` | コア署名（SigningProvider、EvmSignerAdapter、factory） | なし |
| `@agenticvault/agentic-vault/protocols` | プロトコルデコーダー、dispatcher、PolicyEngine V2、workflows | なし |
| `@agenticvault/agentic-vault/agentic` | MCP サーバー、監査ログ記録 | あり |

## ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [インターフェースガイド](docs/guides/interfaces.md) | TypeScript、CLI、MCP、OpenClaw の使い方 |
| [ポリシーリファレンス](docs/reference/policy.md) | ポリシー JSON スキーマ、フィールド、例 |
| [AWS KMS セットアップ](docs/guides/aws-kms-setup.md) | 鍵の作成、IAM ポリシー、認証方法 |
| [OpenClaw プラグイン](packages/openclaw-plugin/) | OpenClaw プラグインパッケージと設定 |
| [アーキテクチャ決定](docs/project/adrs/ADR-001-architecture-decisions.md) | 主要な設計決定の ADR |
| [コントリビュートガイド](CONTRIBUTING.md) | 開発ワークフローとガイドライン |

## ロードマップ

- 追加の署名プロバイダー（GCP KMS、HashiCorp Vault）
- 追加のプロトコルデコーダー（Curve、Compound V3）
- マルチシグネチャ対応
- リモート MCP サーバーモード（HTTP トランスポート + OAuth 2.1）

## コントリビュート

開発ワークフロー、ブランチ命名規則、コミット規約については [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

## ライセンス

[MIT](LICENSE)
