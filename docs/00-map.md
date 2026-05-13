# Documentation Map

이 문서는 `docs/`를 작업 유형별로 빠르게 읽기 위한 지도다.
실행 규칙은 항상 루트 `AGENTS.md`가 우선이고, 이 파일은 어떤 세부 문서를 열지 결정하는 보조 인덱스다.

## Core Rule

문서를 전부 읽는 것이 목표가 아니다.
작업 성격에 맞는 source of truth를 먼저 열고, 필요한 코드/SQL/테스트를 확인한다.

기본 우선순위:

1. `AGENTS.md`
2. `docs/09-keep-rules.md`
3. `docs/03-architecture.md`
4. 작업 유형별 문서
5. 코드와 SQL 구현

## Document Groups

### Product / Scope

- `docs/01-product-canvas.md`
  - 제품 정의, MVP 범위, 핵심 지표, 비범위
- `docs/08-ux-tasks.md`
  - UX 과제 현황, Done/Doing/Backlog

읽는 시점:
- 기능 범위가 바뀔 때
- 우선순위나 MVP 포함 여부를 판단할 때
- backlog 상태를 바꿀 때

### Engineering / Architecture

- `docs/03-architecture.md`
  - 디렉터리 구조, 데이터 모델, 권한 모델, 시스템 경계
- `docs/09-keep-rules.md`
  - 인증/권한/DB/경기 UX/UI 비협상 규칙
- `docs/05-automation.md`
  - 검증 명령, DB 반영 절차, browser/DB smoke

읽는 시점:
- 서비스 경계, 권한, 데이터 흐름을 바꿀 때
- DB/RLS/RPC/migration을 다룰 때
- 검증 명령이나 운영 절차를 바꿀 때

### Design / UX

- `docs/02-design-system.md`
  - 공통 UI 토큰, 타이포, 간격, 컴포넌트 규칙
- `docs/10-history-ui-guidelines.md`
  - 히스토리 화면 표시/QA 기준
- `docs/06-design-handoff.md`
  - 외부 디자인 전달 규격
- `docs/design/README.md`
  - 디자인 세부 문서 진입점
- `docs/design/00-ui-ux-agent-rules.md`
  - UI/UX 에이전트 실행 규칙, shadcn/Radix 우선 정책, IA 검증 기준

읽는 시점:
- 화면 구조, 시각 규칙, 컴포넌트 variant가 바뀔 때
- 히스토리/상세 표시 규칙을 조정할 때
- `club_record` 디자인 방향이나 primitive를 다룰 때

### Auth / Onboarding

- `docs/11-auth-onboarding-design.md`
  - 프로필 완료, 로그인 후 이동, 온보딩 설계
- `docs/07-auth-handoff.md`
  - 인증 관련 과거 인수인계 아카이브
- `docs/03-architecture.md`
  - 최신 Auth Boundary
- `docs/09-keep-rules.md`
  - 유지해야 하는 인증 규칙

읽는 시점:
- Kakao/Email/Guest 로그인 정책을 바꿀 때
- `profile_completed` 가드를 바꿀 때
- 인증 관련 과거 설명과 현재 구현이 충돌하는지 확인할 때

### Club Record

- `docs/club_record.md`
  - 얇은 상위 진입점
- `docs/club-record/README.md`
  - 읽기 순서와 작업별 세부 문서 안내
- `docs/club-record/01-rules.md`
  - 제품/도메인 규칙
- `docs/club-record/02-domain.md`
  - 엔티티, 관계, 상태 모델
- `docs/club-record/03-schema.md`
  - DB 스키마와 migration split
- `docs/club-record/04-access.md`
  - access matrix, service/RPC/RLS 방향
- `docs/club-record/05-implementation.md`
  - feature 구조와 구현 순서
- `docs/club-record/06-checklist.md`
  - migration/구현 전후 체크리스트
- `docs/club-record/07-handoff.md`
  - 현재 상태와 다음 작업자 인수인계
- `docs/club-record/08-review-findings.md`
  - 미해결 리뷰 이슈와 완료 기준

읽는 시점:
- `src/features/club-record/*`
- `src/app/clubs/[clubId]/club-record/*`
- `supabase/migrations/*club_record*`
- `supabase/tests/club_record_smoke.sql`

### Operations / History

- `docs/04-dev-log.md`
  - 날짜별 변경 이력과 결정 이유
- `docs/05-automation.md`
  - 반복 검증/DB/브라우저 자동화, Vercel/GitHub/Supabase CLI 운영 기준

읽는 시점:
- 의미 있는 변경을 끝낼 때
- 최근 결정 배경을 확인할 때
- 검증/배포/DB 절차가 바뀔 때
- Vercel/GitHub/Supabase CLI나 MCP 연결 상태를 확인할 때

## Task-Based Read Paths

### 일반 기능 변경

1. `AGENTS.md`
2. `docs/09-keep-rules.md`
3. `docs/03-architecture.md`
4. 대상 feature 문서 또는 관련 코드
5. 변경 후 `docs/04-dev-log.md`

### DB / RLS / RPC 변경

1. `AGENTS.md`
2. `docs/09-keep-rules.md`
3. `docs/05-automation.md`
4. `docs/03-architecture.md`
5. 관련 migration/schema/RPC
6. 변경 후 `docs/04-dev-log.md`

### UI / UX 변경

1. `AGENTS.md`
2. `docs/02-design-system.md`
3. `docs/design/00-ui-ux-agent-rules.md`
4. 관련 기능 문서
5. 히스토리 화면이면 `docs/10-history-ui-guidelines.md`
6. `club_record` 디자인이면 `docs/design/README.md`
7. 변경 후 `docs/04-dev-log.md`

### Auth / Onboarding 변경

1. `AGENTS.md`
2. `docs/09-keep-rules.md`
3. `docs/11-auth-onboarding-design.md`
4. `docs/03-architecture.md`
5. 필요 시 `docs/07-auth-handoff.md`
6. 변경 후 `docs/04-dev-log.md`

### Club Record 변경

1. `AGENTS.md`
2. `docs/club_record.md`
3. `docs/club-record/README.md`
4. 작업 성격에 맞는 `docs/club-record/*`
5. DB/RLS가 있으면 `docs/05-automation.md`
6. 변경 후 `docs/04-dev-log.md`

## Codex / Claude Notes

- Codex의 기본 프로젝트 작업 규칙은 `AGENTS.md`다.
- 이 저장소에는 하위 폴더별 `AGENTS.md`가 없으므로, 폴더별 자동 지역 규칙은 현재 없다.
- `CLAUDE.md`는 보조 행동 가이드다. Codex가 자동으로 모든 작업에서 읽는 규칙 파일로 보지 않는다.
- 문서에서 `CLAUDE.md` 선독을 명시한 작업, 특히 `club_record` handoff 작업에서는 함께 읽는다.
