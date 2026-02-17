<!-- Source: packages/openclaw-plugin/README.md | Commit: 96a8dcc | Last synced: 2026-02-16 -->

# @agenticvault/openclaw

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어

[Agentic Vault](https://github.com/agenticvault/agentic-vault)의 OpenClaw 플러그인 -- 서버 측 EVM 서명을 기본 거부 정책 엔진이 적용된 OpenClaw 에이전트 도구로 노출합니다.

## 설치

```bash
npm install @agenticvault/openclaw @agenticvault/agentic-vault
```

## 설정

OpenClaw 에이전트 설정에서 플러그인을 등록합니다:

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

## 사용 가능한 도구

### 안전 도구 (항상 등록됨)

| 도구 | 설명 |
|------|------|
| `vault_get_address` | 이 Vault가 관리하는 지갑 주소를 가져옵니다 |
| `vault_health_check` | Vault 서명기의 상태를 확인합니다 |
| `vault_sign_defi_call` | calldata 디코딩 및 정책 검증 후 DeFi 컨트랙트 상호작용에 서명합니다 |
| `vault_sign_permit` | 정책 검증 후 EIP-2612 permit에 서명합니다 |

### 이중 게이트 도구 (`enableUnsafeRawSign: true` 필요)

| 도구 | 설명 |
|------|------|
| `vault_sign_transaction` | 원시 EVM 트랜잭션에 서명합니다 (디코더 파이프라인 우회) |
| `vault_sign_typed_data` | 원시 EIP-712 타입 데이터에 서명합니다 (디코더 파이프라인 우회) |

## 보안

- **기본 거부** -- 모든 서명 작업에 명시적인 정책 승인이 필요합니다
- **페일 클로즈** -- 알 수 없는 calldata는 항상 거부됩니다
- **이중 게이트 원시 서명** -- `vault_sign_transaction`과 `vault_sign_typed_data`는 기본적으로 비활성화됩니다. 활성화하려면 플러그인 설정에서 `enableUnsafeRawSign: true`를 설정해야 합니다
- **감사 추적** -- 모든 작업은 구조화된 JSON으로 기록됩니다

## 정책 설정

전체 예제는 메인 저장소의 [정책 설정 문서](https://github.com/agenticvault/agentic-vault#configuration)와 [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json)를 참조하세요.

## 라이선스

[MIT](LICENSE)
