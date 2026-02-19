<!-- Source: packages/openclaw-plugin/README.md | Last synced: 2026-02-19 -->

# @agenticvault/openclaw

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어

[Agentic Vault](https://github.com/agenticvault/agentic-vault)의 OpenClaw 플러그인 -- 서버 측 EVM 서명을 기본 거부 정책 엔진이 적용된 OpenClaw 에이전트 도구로 노출합니다.

## 설치

### 빠른 시작 (권장)

패키지를 설치한 후 OpenClaw extensions 디렉토리에 복사합니다:

```bash
npm install @agenticvault/openclaw
mkdir -p ~/.openclaw/extensions/agentic-vault
cp -r ./node_modules/@agenticvault/openclaw/* ~/.openclaw/extensions/agentic-vault/
```

OpenClaw은 `~/.openclaw/extensions/` 내의 플러그인을 자동으로 감지합니다. 디렉토리 이름은 매니페스트 `id` (`agentic-vault`)와 일치해야 합니다.

### Tarball에서 설치 (로컬 node_modules 불필요)

프로젝트 레벨 설치 없이 직접 다운로드하여 압축 해제합니다:

```bash
npm pack @agenticvault/openclaw --pack-destination /tmp
mkdir -p ~/.openclaw/extensions/agentic-vault
tar -xzf /tmp/agenticvault-openclaw-*.tgz -C ~/.openclaw/extensions/agentic-vault --strip-components=1
```

### 개발 모드 (Symlink)

플러그인 개발 시 extensions 디렉토리에 symlink를 생성합니다:

```bash
mkdir -p ~/.openclaw/extensions
ln -sfn "$(pwd)/packages/openclaw-plugin" ~/.openclaw/extensions/agentic-vault
```

### `plugins.load.paths`를 통한 설치 (고급)

플러그인 로딩 경로를 완전히 제어하려면:

```bash
mkdir -p /home/user/my-workspace/.openclaw/extensions
cd /home/user/my-workspace/.openclaw/extensions
npm install @agenticvault/openclaw
```

그런 다음 OpenClaw 호스트 설정에 경로를 추가합니다 (프로덕션/데몬 환경에서는 절대 경로를 사용하세요):

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/user/my-workspace/.openclaw/extensions/node_modules/@agenticvault/openclaw"]
    }
  }
}
```

> **팁**: 프로덕션 환경에서는 정확한 버전을 고정하세요 (`npm install @agenticvault/openclaw@0.1.2`). 예기치 않은 업그레이드를 방지합니다.

> **알려진 제한**: `openclaw plugins install` (로컬 경로 및 `--link`를 포함한 모든 변형)은 unscoped npm 패키지 이름에서 extension ID (`openclaw`)를 유도하며, 이는 매니페스트 `id` (`agentic-vault`)와 일치하지 않아 설정 키 충돌이 발생합니다. 업스트림에서 수정될 때까지 위의 방법을 사용하여 설치하세요.

## 설정

OpenClaw 호스트 설정에서 플러그인을 등록합니다. entries 키는 매니페스트 `id` (`"agentic-vault"`)와 일치해야 합니다. 설정에서 `plugins.allow`를 사용하는 경우 `"agentic-vault"`를 포함하세요:

```json
{
  "plugins": {
    "allow": ["agentic-vault"],
    "entries": {
      "agentic-vault": {
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

| 옵션 | 필수 | 설명 |
|------|------|------|
| `keyId` | 예 | AWS KMS 키 ARN |
| `region` | 예 | AWS 리전 |
| `policyConfigPath` | 아니오 | 정책 JSON 파일 경로 (미지정 시 기본 전체 거부) |
| `rpcUrl` | 아니오 | 잔액/전송 도구용 RPC 엔드포인트. `vault_get_balance`, `vault_send_transfer`, `vault_send_erc20_transfer` 사용 시 필요. |
| `expectedAddress` | 아니오 | 검증용 예상 지갑 주소 |
| `enableUnsafeRawSign` | 아니오 | 원시 서명 도구 활성화 (기본값: `false`) |

## 사용 가능한 도구

### 안전 도구 (항상 등록됨)

| 도구 | 설명 |
|------|------|
| `vault_get_address` | 이 Vault가 관리하는 지갑 주소를 가져옵니다 |
| `vault_health_check` | Vault 서명기의 상태를 확인합니다 |
| `vault_sign_defi_call` | calldata 디코딩 및 정책 검증 후 DeFi 컨트랙트 상호작용에 서명합니다 |
| `vault_sign_permit` | 정책 검증 후 EIP-2612 permit에 서명합니다 |
| `vault_get_balance` | 네이티브 또는 ERC20 토큰 잔액을 조회합니다 (`rpcUrl` 필요) |
| `vault_send_transfer` | 정책 검증과 함께 네이티브 ETH를 전송합니다 (`rpcUrl` 필요) |
| `vault_send_erc20_transfer` | 정책 검증과 함께 ERC20 토큰을 전송합니다 (`rpcUrl` 필요) |

### 이중 게이트 도구 (`enableUnsafeRawSign: true` 필요)

| 도구 | 설명 |
|------|------|
| `vault_sign_transaction` | 원시 EVM 트랜잭션에 서명합니다 (디코더 파이프라인 우회) |
| `vault_sign_typed_data` | 원시 EIP-712 타입 데이터에 서명합니다 (디코더 파이프라인 우회) |

## 프리릴리스 API에서 마이그레이션

플러그인 진입점이 프리릴리스 `register(api, config)`에서 공식 SDK 계약 `export default function(api)`로 변경되었습니다:

| 변경 전 (프리릴리스) | 변경 후 (현재) |
|---------------------|---------------|
| `import { register } from "@agenticvault/openclaw"` | `export default function(api)` |
| `register(api, config)` | 설정은 `api.pluginConfig`에서 읽음 |
| `api.registerTool(name, config, handler)` | `api.registerTool({ name, description, parameters, label, execute })` |

플러그인은 이제 공식 `openclaw/plugin-sdk` 타입을 사용하며, `package.json`의 `openclaw` 필드를 통해 OpenClaw 게이트웨이에서 검색됩니다.

## 보안

- **기본 거부** -- 모든 서명 작업에 명시적인 정책 승인이 필요합니다
- **페일 클로즈** -- 알 수 없는 calldata는 항상 거부됩니다
- **이중 게이트 원시 서명** -- `vault_sign_transaction`과 `vault_sign_typed_data`는 기본적으로 비활성화됩니다. 활성화하려면 플러그인 설정에서 `enableUnsafeRawSign: true`를 설정해야 합니다
- **감사 추적** -- 모든 작업은 구조화된 JSON으로 기록됩니다

## 멀티 에이전트 환경 강화

멀티 에이전트 환경에서는 vault 도구를 지정된 금융 에이전트로만 제한합니다. 비금융 에이전트의 `tools.deny`에 모든 `vault_*` 도구 이름을 추가하세요:

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

## 정책 설정

전체 예제는 메인 저장소의 [정책 설정 문서](https://github.com/agenticvault/agentic-vault#configuration)와 [`policy.example.json`](https://github.com/agenticvault/agentic-vault/blob/main/policy.example.json)를 참조하세요.

## 라이선스

[MIT](LICENSE)
