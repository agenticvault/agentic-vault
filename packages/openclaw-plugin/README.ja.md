<!-- Source: packages/openclaw-plugin/README.md | Last synced: 2026-02-20 -->

# @agenticvault/agentic-vault-openclaw

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | 日本語 | [한국어](README.ko.md)

[Agentic Vault](https://github.com/agenticvault/agentic-vault) の OpenClaw プラグイン -- サーバーサイド EVM 署名をデフォルト拒否のポリシーエンジン付き OpenClaw エージェントツールとして公開します。

## インストール

### ワンコマンドインストール（推奨）

```bash
npx -y -p @agenticvault/agentic-vault-openclaw agentic-vault-setup
```

このコマンドはプラグインファイルを `~/.openclaw/extensions/agentic-vault-openclaw/` にコピーし、ランタイム依存関係をインストールし、設定スニペットを出力します。画面の指示に従ってセットアップを完了してください。

### クイックスタート（手動）

パッケージをインストールし、OpenClaw extensions ディレクトリにコピーします：

```bash
npm install @agenticvault/agentic-vault-openclaw
mkdir -p ~/.openclaw/extensions/agentic-vault-openclaw
cp -r ./node_modules/@agenticvault/agentic-vault-openclaw/* ~/.openclaw/extensions/agentic-vault-openclaw/
cd ~/.openclaw/extensions/agentic-vault-openclaw && npm install --omit=dev --ignore-scripts
```

OpenClaw は `~/.openclaw/extensions/` 内のプラグインを自動検出します。ディレクトリ名はマニフェスト `id`（`agentic-vault-openclaw`）と一致させる必要があります。

### Tarball からインストール（ローカル node_modules 不要）

プロジェクトレベルのインストールなしで直接ダウンロード・展開します：

```bash
npm pack @agenticvault/agentic-vault-openclaw --pack-destination /tmp
mkdir -p ~/.openclaw/extensions/agentic-vault-openclaw
tar -xzf /tmp/agenticvault-agentic-vault-openclaw-*.tgz -C ~/.openclaw/extensions/agentic-vault-openclaw --strip-components=1
cd ~/.openclaw/extensions/agentic-vault-openclaw && npm install --omit=dev --ignore-scripts
```

### 開発モード（シンボリックリンク）

プラグイン開発時は、extensions ディレクトリにシンボリックリンクを作成します：

```bash
mkdir -p ~/.openclaw/extensions
ln -sfn "$(pwd)/packages/openclaw-plugin" ~/.openclaw/extensions/agentic-vault-openclaw
```

### `plugins.load.paths` 経由（上級者向け）

プラグインの読み込みパスを完全に制御したい場合：

```bash
mkdir -p /home/user/my-workspace/.openclaw/extensions
cd /home/user/my-workspace/.openclaw/extensions
npm install @agenticvault/agentic-vault-openclaw
```

次に、OpenClaw ホスト設定にパスを追加します（本番/デーモン環境では絶対パスを使用してください）：

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/user/my-workspace/.openclaw/extensions/node_modules/@agenticvault/agentic-vault-openclaw"]
    }
  }
}
```

> **ヒント**：本番環境では正確なバージョンを固定してください（`npm install @agenticvault/agentic-vault-openclaw@0.1.3`）。予期しないアップグレードを防止します。

## 設定

OpenClaw ホスト設定にプラグインを登録します。entries キーはマニフェストの `id`（`"agentic-vault-openclaw"`）と一致する必要があります。設定で `plugins.allow` を使用している場合は、`"agentic-vault-openclaw"` を追加してください：

```json
{
  "plugins": {
    "allow": ["agentic-vault-openclaw"],
    "entries": {
      "agentic-vault-openclaw": {
        "config": {
          "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
          "region": "us-east-1",
          "policyConfigPath": "/home/user/agentic-vault/policy.json",
          "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
        }
      }
    }
  }
}
```

| オプション | 必須 | 説明 |
|------------|------|------|
| `keyId` | はい | AWS KMS キー ARN |
| `region` | はい | AWS リージョン |
| `policyConfigPath` | いいえ | ポリシー JSON ファイルパス（未指定時はすべて拒否） |
| `rpcUrl` | いいえ | 残高/送金ツール用の RPC エンドポイント。`vault_get_balance`、`vault_send_transfer`、`vault_send_erc20_transfer` の使用時に必要。 |
| `expectedAddress` | いいえ | 検証用の期待されるウォレットアドレス |
| `enableUnsafeRawSign` | いいえ | 生署名ツールを有効化（デフォルト：`false`） |

## 利用可能なツール

### セーフツール（常時登録）

| ツール | 説明 |
|--------|------|
| `vault_get_address` | この Vault が管理するウォレットアドレスを取得します |
| `vault_health_check` | Vault 署名器のヘルスステータスを確認します |
| `vault_sign_defi_call` | calldata デコードとポリシー検証後に DeFi コントラクトインタラクションに署名します |
| `vault_sign_permit` | ポリシー検証後に EIP-2612 permit に署名します |
| `vault_get_balance` | ネイティブまたは ERC20 トークン残高を照会します（`rpcUrl` が必要） |
| `vault_send_transfer` | ポリシー検証付きでネイティブ ETH を送金します（`rpcUrl` が必要） |
| `vault_send_erc20_transfer` | ポリシー検証付きで ERC20 トークンを送金します（`rpcUrl` が必要） |

### デュアルゲートツール（`enableUnsafeRawSign: true` が必要）

| ツール | 説明 |
|--------|------|
| `vault_sign_transaction` | 生の EVM トランザクションに署名します（デコーダーパイプラインをバイパス） |
| `vault_sign_typed_data` | 生の EIP-712 型付きデータに署名します（デコーダーパイプラインをバイパス） |

## プレリリース API からの移行

プラグインのエントリーポイントがプレリリースの `register(api, config)` から公式 SDK コントラクト `export default function(api)` に変更されました：

| 変更前（プレリリース） | 変更後（現在） |
|------------------------|---------------|
| `import { register } from "@agenticvault/agentic-vault-openclaw"` | `export default function(api)` |
| `register(api, config)` | 設定は `api.pluginConfig` から読み取り |
| `api.registerTool(name, config, handler)` | `api.registerTool({ name, description, parameters, label, execute })` |

プラグインは公式の `openclaw/plugin-sdk` 型を使用するようになり、`package.json` の `openclaw` フィールドを通じて OpenClaw ゲートウェイから検出可能です。

## セキュリティ

- **デフォルト拒否** -- すべての署名操作に明示的なポリシー承認が必要です
- **フェイルクローズ** -- 不明な calldata は常に拒否されます
- **デュアルゲート生署名** -- `vault_sign_transaction` と `vault_sign_typed_data` はデフォルトで無効です。有効にするにはプラグイン設定で `enableUnsafeRawSign: true` を設定する必要があります
- **監査証跡** -- すべての操作は構造化 JSON として記録されます

## マルチエージェント環境の強化

マルチエージェント環境では、vault ツールを指定された金融エージェントのみに制限します。非金融エージェントの `tools.deny` にすべての `vault_*` ツール名を追加してください：

```json
{
  "agents": {
    "general-assistant": {
      "tools": {
        "deny": [
          "vault_get_address", "vault_health_check", "vault_get_balance",
          "vault_sign_defi_call", "vault_sign_permit",
          "vault_send_transfer", "vault_send_erc20_transfer",
          "vault_sign_transaction", "vault_sign_typed_data"
        ]
      }
    }
  }
}
```

## ポリシー設定

完全な例については、メインリポジトリの[ポリシー設定ドキュメント](https://github.com/agenticvault/agentic-vault#configuration)と [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) をご覧ください。

## ライセンス

[MIT](LICENSE)
