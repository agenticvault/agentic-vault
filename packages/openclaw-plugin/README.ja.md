<!-- Source: packages/openclaw-plugin/README.md | Commit: 96a8dcc | Last synced: 2026-02-16 -->

# @agenticvault/openclaw

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | 日本語 | [한국어](README.ko.md)

[Agentic Vault](https://github.com/agenticvault/agentic-vault) の OpenClaw プラグイン -- サーバーサイド EVM 署名をデフォルト拒否のポリシーエンジン付き OpenClaw エージェントツールとして公開します。

## インストール

```bash
npm install @agenticvault/openclaw @agenticvault/agentic-vault
```

## 設定

OpenClaw エージェント設定にプラグインを登録します：

```json
{
  "plugins": {
    "agentic-vault": {
      "package": "@agenticvault/openclaw",
      "config": {
        "keyId": "arn:aws:kms:us-east-1:123456789:key/your-key-id",
        "region": "us-east-1",
        "policyConfigPath": "./policy.json"
      }
    }
  }
}
```

## 利用可能なツール

### セーフツール（常時登録）

| ツール | 説明 |
|--------|------|
| `vault_get_address` | この Vault が管理するウォレットアドレスを取得します |
| `vault_health_check` | Vault 署名器のヘルスステータスを確認します |
| `vault_sign_defi_call` | calldata デコードとポリシー検証後に DeFi コントラクトインタラクションに署名します |
| `vault_sign_permit` | ポリシー検証後に EIP-2612 permit に署名します |

### デュアルゲートツール（`enableUnsafeRawSign: true` が必要）

| ツール | 説明 |
|--------|------|
| `vault_sign_transaction` | 生の EVM トランザクションに署名します（デコーダーパイプラインをバイパス） |
| `vault_sign_typed_data` | 生の EIP-712 型付きデータに署名します（デコーダーパイプラインをバイパス） |

## セキュリティ

- **デフォルト拒否** -- すべての署名操作に明示的なポリシー承認が必要です
- **フェイルクローズ** -- 不明な calldata は常に拒否されます
- **デュアルゲート生署名** -- `vault_sign_transaction` と `vault_sign_typed_data` はデフォルトで無効です。有効にするにはプラグイン設定で `enableUnsafeRawSign: true` を設定する必要があります
- **監査証跡** -- すべての操作は構造化 JSON として記録されます

## ポリシー設定

完全な例については、メインリポジトリの[ポリシー設定ドキュメント](https://github.com/agenticvault/agentic-vault#configuration)と [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json) をご覧ください。

## ライセンス

[MIT](LICENSE)
