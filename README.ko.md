<!-- Source: README.md | Commit: 96a8dcc | Last synced: 2026-02-16 -->

# Agentic Vault

[![npm version](https://img.shields.io/npm/v/@agenticvault/agentic-vault)](https://www.npmjs.com/package/@agenticvault/agentic-vault)
[![CI](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticvault/agentic-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어

AWS KMS를 활용한 서버 측 EVM 서명과 내장된 DeFi 프로토콜 인식 기능을 제공합니다. MCP, CLI 또는 OpenClaw를 통해 지갑을 AI 에이전트에 노출하며, 기본 거부 정책 엔진과 완전한 감사 로깅을 갖추고 있습니다.

## Agentic Vault를 선택하는 이유

AI 에이전트는 블록체인 트랜잭션에 서명해야 하지만, 개인키를 직접 제공하는 것은 위험합니다. Agentic Vault는 키를 AWS KMS(HSM)에 보관하고, 에이전트가 서명할 수 있는 작업 범위를 제한하는 정책 엔진을 제공합니다. 에이전트는 고수준 도구(`sign_swap`, `sign_permit`)만 볼 수 있으며, 개인키는 절대 하드웨어 밖으로 나가지 않습니다.

## 주요 기능

- **HSM 기반 안전한 서명** -- 개인키는 AWS KMS를 벗어나지 않으며, 서명에는 다이제스트만 전송됩니다
- **DeFi 프로토콜 인식** -- ERC-20, Uniswap V3, Aave V3의 calldata 디코딩 및 프로토콜별 정책 규칙 지원
- **기본 거부 정책 엔진** -- 체인 ID, 컨트랙트, 셀렉터, 금액, 기한 및 프로토콜 수준 제약
- **다양한 인터페이스** -- TypeScript 라이브러리, CLI, MCP 서버 또는 OpenClaw 플러그인으로 사용 가능
- **감사 로그** -- 모든 서명 작업(승인, 거부, 오류)에 대한 구조화된 JSON 감사 기록
- **EVM 네이티브** -- [viem](https://viem.sh) 기반으로 구축, EIP-712 타입 데이터 완전 지원

## 빠른 시작

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

AWS 없이 빠른 테스트를 하려면 `dry-run` 모드(디코딩 + 정책 검사만, 서명 없음)를 사용하세요:

```bash
npx agentic-vault dry-run --chain-id 1 --to 0xa0b869... --data 0x095ea7b3...
```

키 생성 및 IAM 정책 설정은 [AWS KMS 설정 가이드](docs/guides/aws-kms-setup.md)를 참조하세요.

## 인터페이스

| 인터페이스 | 사용 사례 | AWS 필수 |
|-----------|----------|:---:|
| TypeScript 라이브러리 | 애플리케이션에 서명 기능 내장 | 예 |
| CLI | 커맨드라인 서명 + 드라이런 | 부분 |
| MCP 서버 | AI 에이전트(Claude 등)에 지갑 노출 | 예 |
| OpenClaw 플러그인 | OpenClaw 에이전트 도구로 사용 | 예 |

사용 예제 및 설정은 [인터페이스 가이드](docs/guides/interfaces.md)를 참조하세요.

## 지원 프로토콜

| 프로토콜 | 작업 | 디코더 | 정책 평가기 |
|---------|------|:---:|:---:|
| ERC-20 | `approve`, `transfer` | 있음 | 있음 (승인 한도, spender 화이트리스트) |
| Uniswap V3 | `exactInputSingle` | 있음 | 있음 (토큰 페어, 슬리피지, 수신자) |
| Aave V3 | `supply`, `borrow`, `repay`, `withdraw` | 있음 | 있음 (자산 화이트리스트, 금리 모드) |

알 수 없는 calldata는 항상 거부됩니다(페일 클로즈). Dispatcher는 2단계 해석을 사용합니다: 먼저 컨트랙트 주소, 그다음 셀렉터 기반 폴백(예: ERC-20).

## 설정

정책 엔진은 JSON 설정 파일을 사용합니다. 정책 파일이 제공되지 않으면 정책으로 관리되는 모든 서명 작업이 거부됩니다(기본 거부).

전체 스키마와 예제는 [정책 레퍼런스](docs/reference/policy.md)를 참조하거나, [`policy.example.json`](policy.example.json)에서 시작하세요.

## 보안 모델

### 신뢰 경계

```
 AI 에이전트 (Claude / MCP Client / OpenClaw)
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
             | 다이제스트만 전송
             v
 +------------------------------------+
 |       AWS KMS (HSM)                |
 |   개인키는 외부로 유출되지 않음       |
 +------------------------------------+
```

### 핵심 원칙

| 원칙 | 설명 |
|------|------|
| 키 격리 | 개인키는 HSM 내에 보관되며, 서명에는 32바이트 다이제스트만 전송됩니다 |
| 기본 거부 | 정책 엔진은 명시적으로 허용되지 않은 모든 요청을 거부합니다 |
| 페일 클로즈 | 알 수 없는 calldata는 항상 거부됩니다. 알려진 프로토콜이라도 평가기가 없으면 거부됩니다 |
| 감사 추적 | 모든 작업은 구조화된 JSON으로 stderr에 기록되며, 호출자 태그가 포함됩니다 |
| 최소 공격면 | 원시 서명 도구(`sign_transaction`, `sign_typed_data`)는 기본적으로 비활성화됩니다 |

## Claude Code 플러그인

4개의 스킬이 MCP 도구를 통해 지갑과 상호작용합니다. 키에 직접 접근하지 않습니다.

| 스킬 | 설명 |
|------|------|
| `sign-swap` | 스왑 서명 작업 오케스트레이션 |
| `sign-permit` | EIP-2612 permit 서명 오케스트레이션 |
| `check-wallet` | 지갑 주소 및 상태 확인 |
| `audit-log` | 감사 로그 조회 |

## 패키지 내보내기

| 서브경로 | 내용 | MCP 의존성 |
|---------|------|:-:|
| `@agenticvault/agentic-vault` | 코어 서명 (SigningProvider, EvmSignerAdapter, factory) | 없음 |
| `@agenticvault/agentic-vault/protocols` | 프로토콜 디코더, dispatcher, PolicyEngine V2, workflows | 없음 |
| `@agenticvault/agentic-vault/agentic` | MCP 서버, 감사 로그 기록 | 있음 |

## 문서

| 문서 | 설명 |
|------|------|
| [인터페이스 가이드](docs/guides/interfaces.md) | TypeScript, CLI, MCP, OpenClaw 사용법 |
| [정책 레퍼런스](docs/reference/policy.md) | 정책 JSON 스키마, 필드, 예제 |
| [AWS KMS 설정](docs/guides/aws-kms-setup.md) | 키 생성, IAM 정책, 인증 방법 |
| [OpenClaw 플러그인](packages/openclaw-plugin/) | OpenClaw 플러그인 패키지 및 설정 |
| [아키텍처 결정](docs/project/adrs/ADR-001-architecture-decisions.md) | 주요 설계 결정 ADR |
| [기여 가이드](CONTRIBUTING.md) | 개발 워크플로 및 가이드라인 |

## 로드맵

- 추가 서명 프로바이더 (GCP KMS, HashiCorp Vault)
- 추가 프로토콜 디코더 (Curve, Compound V3)
- 멀티시그 지원
- 원격 MCP 서버 모드 (HTTP 전송 + OAuth 2.1)

## 기여하기

개발 워크플로, 브랜치 명명 규칙, 커밋 규약은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

본 프로젝트는 [Contributor Covenant 행동 강령](CODE_OF_CONDUCT.md)을 따릅니다.

## 라이선스

[MIT](LICENSE)
