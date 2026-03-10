# Tournament Record Agent Guide

이 문서는 이 저장소에서 작업하는 사람/에이전트가 가장 먼저 따라야 하는 운영 기준이다.
목표는 세 가지다.

1. 코드 변경 시 제품 규칙을 깨지 않는다.
2. DB/권한/UX 관련 비가시적 제약을 놓치지 않는다.
3. 작업 중 문서가 뒤처지지 않게 `docs/`를 지속적으로 함께 관리한다.

이 문서는 설계 배경 전체를 대체하지 않는다. 실행 지침과 체크리스트를 제공한다.
상세 설명은 `docs/`의 각 문서를 source of truth로 사용한다.

## 1. Project Snapshot

- 제품: 아마추어 테니스 모임/클럽의 경기 기록 서비스
- 스택: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Vercel
- 핵심 도메인:
  - 클럽 생성/참가/초대 링크
  - 멤버 역할 및 개인 공개 설정
  - 단식/복식 경기 기록
  - 경기 히스토리 및 상세
  - 리더보드
  - 경기 결과 확인/거절 플로우

현재 기준 주요 사용자 상태:
- 등록 사용자: 카카오 OAuth 또는 Email/Password
- 게스트 사용자: 초대 링크를 통해 anonymous 세션으로 참가 가능

현재 기준 주요 경기 상태:
- `submitted`: 기록 저장됨, 상대 확인 대기
- `confirmed`: 확인 대상 전원 승인 완료
- `disputed`: 확인 거절됨, 재검토 필요

## 2. Source Of Truth

작업 중 판단이 필요하면 아래 우선순위로 문서를 본다.

1. 이 파일 `AGENTS.md`
2. `docs/09-keep-rules.md`
3. `docs/03-architecture.md`
4. 기능별 세부 문서
5. 코드 구현

문서별 책임:
- `docs/01-product-canvas.md`
  - 문제 정의, MVP 범위, 핵심 지표
- `docs/02-design-system.md`
  - 레이아웃, 토큰, 공용 UI 규칙
- `docs/03-architecture.md`
  - 디렉터리 구조, 데이터 모델, 권한 모델, 시스템 경계
- `docs/04-dev-log.md`
  - 날짜별 변경 기록
- `docs/05-automation.md`
  - 실행 명령어, DB 반영 방식, 운영 자동화
- `docs/06-design-handoff.md`
  - 외부 디자인 전달 규격
- `docs/07-auth-handoff.md`
  - 인증 관련 과거 인수인계 아카이브
- `docs/08-ux-tasks.md`
  - 진행 중 UX 과제 및 후속 작업 상태
- `docs/09-keep-rules.md`
  - 반드시 유지해야 하는 비협상 규칙
- `docs/10-history-ui-guidelines.md`
  - 히스토리 화면의 표시 및 QA 기준

## 3. Non-Negotiable Domain Rules

### 3.1 Auth / Account

- 인증 책임은 `src/features/auth/services/auth.ts`에 둔다.
- `getCurrentUser()`의 `Auth session missing` 예외 무시 정책을 유지한다.
- 카카오 로그인 scope는 기본적으로 `profile_nickname profile_image`를 유지한다.
- 카카오 사용자 로그아웃은 Supabase sign-out 이후 카카오 로그아웃 URL 연동을 유지한다.
- 이메일 로그인/회원가입 경로는 항상 활성 상태로 둔다.
- 게스트 계정은 허용할 수 있지만 권한은 반드시 제한한다.

### 3.2 Club / Membership

- 클럽명 변경은 `owner`만 가능해야 한다.
- 멤버에게 클럽명 편집 UI를 노출하지 않는다.
- 내 닉네임/개인 설정은 멤버 목록의 `내 항목` 편집 모달에서만 변경한다.
- 클럽명 정규화 unique, 클럽 내 닉네임 정규화 unique 제약을 유지한다.
- 초대 링크는 `invite_expires_at`을 유지하고 재발급은 `owner`만 가능해야 한다.
- 멤버 삭제는 하드 삭제가 아니라 소프트 삭제(`is_active=false`, `left_at`)로 유지한다.

### 3.3 Match Recording / Confirmation

- 경기 기록 입력은 타이핑보다 선택형 UX를 우선한다.
- 팀 표기는 `사이드 1/2` 대신 선수 이름 기반을 유지한다.
- 용어는 `게임` 중심으로 유지하고 `라운드/세트` 혼용을 피한다.
- 목표 게임 선택과 검증 규칙은 유지한다.
  - 6게임: `6-0` ~ `6-4`, `7-5`, `7-6`
  - 4게임: `4-0` ~ `4-2`, `5-3`, `5-4`
- 미완료 게임은 숨기지 않고 `미완료` 상태로 드러낸다.
- 미완료 게임도 저장 가능해야 한다.
- 게스트는 경기 `조회/참가`만 가능하고 `생성/수정`은 불가해야 한다.
- 경기 생성/수정 직후 상태는 `submitted`를 기본으로 유지한다.
- 상대 확인이 끝나기 전 즉시 `confirmed`로 바꾸면 안 된다.
- 경기 결과는 확인 대상 전원이 승인해야만 `confirmed`가 된다.
- 하나라도 거절하면 `disputed`로 전환되어야 한다.
- 리더보드/확정 결과 반영은 `confirmed` 경기만 대상으로 한다.

### 3.4 History / Detail UI

- 경기 상세 상단은 `팀명 + 전체 스코어` 중심 배치를 유지한다.
- 게임별 상세 테이블은 선수명 헤더를 유지한다.
- 포인트는 미입력 시 숨기고 입력된 경우에만 표시한다.
- 히스토리는 `카드/리스트` 2가지 보기 모드를 유지한다.
- 히스토리 필터는 기본적으로 `날짜 + 상대 이름`이다.
- 히스토리는 무한 스크롤과 초기 노출 제한을 유지한다.
- 카드 모드 헤더 순서는 `결과 배지 -> 단식/복식 -> 상태`를 유지한다.
- 리스트 모드는 배지 대신 결과 기반의 얕은 배경색을 사용한다.
- 미확정 경기(`submitted`, `disputed`)는 승패 색상 강조보다 중립/상태 중심 표현을 우선한다.

### 3.5 UI Implementation

- 인라인 편집 폼 남발을 금지한다.
- 편집은 연필 아이콘 + 모달/다이얼로그 패턴을 기본으로 한다.
- 공통 모달은 `src/components/ui/dialog.tsx`, `src/components/common/modal.tsx`를 재사용한다.
- 주요 페이지 레이아웃은 `AppBar + content(px-4)` 구조를 기본으로 유지한다.
- `AppShell`은 공통 캔버스 역할만 담당하고 페이지별 본문 패딩은 각 화면이 책임진다.
- 승/패 색상은 `src/app/globals.css`의 테니스 토큰을 우선 사용한다.

## 4. Architecture Guardrails

### 4.1 Directory Responsibility

- `src/app`
  - 라우트 조립과 페이지 엔트리만 담당한다.
- `src/features/auth`
  - 세션, 로그인, 로그아웃, 사용자 요구사항 검증 책임
- `src/features/clubs`
  - 클럽, 멤버, 초대, 공개 설정 관련 도메인
- `src/features/matches`
  - 경기 생성, 수정, 상세, 히스토리, 점수, 확인 플로우
- `src/features/leaderboard`
  - 전적 집계와 표시
- `src/components`
  - 재사용 UI 및 레이아웃
- `src/lib/supabase`
  - 클라이언트 초기화
- `supabase/migrations`
  - 운영 기준 SQL 원본

### 4.2 Service Boundaries

- 인증 로직을 클럽/경기 서비스에 중복 구현하지 않는다.
- 권한 체크는 가능한 한 DB 정책과 서비스 계층 양쪽에서 일관되게 유지한다.
- RLS나 RPC가 관여하는 기능은 프론트 코드만 고치고 끝내지 않는다.

## 5. DB Change Policy

- 코드 변경과 DB 변경은 분리 관리한다.
- DB 반영이 필요한 기능은 SQL이 준비되고 적용되기 전까지 완료로 간주하지 않는다.
- 신규 SQL은 반드시 `supabase/migrations/*.sql`에 남긴다.
- 현재 운영 정책상 실제 반영은 Supabase `SQL Editor` 수동 실행을 기본으로 한다.
- DB 구조, 정책, RPC, enum, trigger, index 변경이 있으면 아래를 함께 점검한다.
  - `supabase/schema.sql`
  - `docs/03-architecture.md`
  - `docs/05-automation.md`
  - `docs/04-dev-log.md`

## 6. Working Style

### 6.1 Before You Edit

작업 시작 전 최소한 아래를 확인한다.

1. 관련 기능의 source of truth 문서
2. 관련 서비스/컴포넌트/타입 파일
3. 현재 워크트리의 기존 변경사항

추정으로 진행하지 말고, 먼저 코드와 문서의 현재 상태를 확인한다.

### 6.2 While You Edit

- 기존 코드베이스의 패턴을 우선 따른다.
- 빠른 임시방편보다 정확성과 일관성을 우선한다.
- 광범위한 `try/catch`, silent failure, 의미 없는 fallback을 넣지 않는다.
- 새로운 개념을 추가했다면 타입, 서비스, UI, 문서에서 용어를 통일한다.
- 사용자 메시지 문구는 현재 제품 용어와 맞춰 작성한다.

### 6.3 After You Edit

가능하면 아래를 수행한다.

1. 관련 테스트 실행
2. `npm run lint`
3. 필요 시 `npm run build`
4. 문서 갱신

검증을 하지 못했다면 이유를 명확히 남긴다.

## 7. Documentation Management Rules

이 저장소에서는 기능 구현과 문서 갱신을 같은 작업으로 본다.
문서는 “나중에 정리”가 아니라 “같은 변경 세트 안에서 업데이트”가 원칙이다.

### 7.1 Automatic Documentation Rule

아래 수준의 변경이 있으면 문서를 자동으로 함께 수정한다.

- 사용자에게 보이는 기능 추가/삭제/변경
- 권한 정책 변경
- DB 스키마/RPC/RLS 변경
- 상태 이름, 용어, 카피 변경
- 레이아웃/디자인 규칙 변경
- 검증/배포/운영 절차 변경

즉, 코드만 바꾸고 문서를 그대로 두는 상태를 예외로 취급한다.

### 7.2 Required Document Update Matrix

변경 유형별 필수 문서:

- 제품 범위/MVP/핵심 가치 변화
  - `docs/01-product-canvas.md`
  - `README.md`
  - `docs/04-dev-log.md`

- UI 규칙/레이아웃/토큰/컴포넌트 규칙 변화
  - `docs/02-design-system.md`
  - 필요 시 `docs/06-design-handoff.md`
  - `docs/04-dev-log.md`

- 디렉터리 구조/데이터 모델/권한 구조 변화
  - `docs/03-architecture.md`
  - `docs/09-keep-rules.md`가 영향받으면 함께 수정
  - `docs/04-dev-log.md`

- DB 마이그레이션/RPC/RLS/운영 절차 변화
  - `docs/05-automation.md`
  - `docs/03-architecture.md`
  - `docs/04-dev-log.md`

- 인증 정책 변화
  - `docs/03-architecture.md`
  - `docs/05-automation.md`
  - `docs/09-keep-rules.md`
  - `docs/07-auth-handoff.md`는 아카이브 성격이므로, 과거 설명과 현재 기준 차이가 커질 때만 갱신

- UX 백로그 상태 변화
  - `docs/08-ux-tasks.md`
  - `docs/04-dev-log.md`

- 히스토리 화면 규칙/표현/QA 기준 변화
  - `docs/10-history-ui-guidelines.md`
  - `docs/02-design-system.md` 또는 `docs/09-keep-rules.md`가 영향받으면 함께 수정
  - `docs/04-dev-log.md`

### 7.3 Dev Log Rule

의미 있는 변경은 반드시 `docs/04-dev-log.md`에 날짜 기준으로 남긴다.

기록 기준:
- 무엇을 바꿨는지
- 왜 바꿨는지
- 어떤 제약/정책이 추가되었는지

사소한 오탈자 수정 정도가 아니면 생략하지 않는다.

### 7.4 Documentation Consistency Rule

문서 수정 시 아래를 확인한다.

- 같은 개념이 여러 문서에서 다른 이름으로 불리지 않는가
- 이미 완료된 기능이 backlog에 남아 있지 않은가
- 현재 정책과 아카이브 문서가 충돌하지 않는가
- README의 공개 요약과 내부 문서의 실제 상태가 어긋나지 않는가
- 새 상태/새 역할/새 용어가 추가됐는데 설명 문서가 빠지지 않았는가

## 8. Verification Commands

기본 검증:

```bash
npm run test
npm run lint
npm run build
```

운영/자동화 관련:

```bash
npm run env:check
npm run db:smoke
npm run db:push:dry
npm run automation:check
```

주의:
- DB 마이그레이션은 dry-run을 우선한다.
- 운영 기준 실제 반영은 문서화된 수동 절차를 따른다.

## 9. Change Checklists

### 9.1 Feature Change Checklist

- 관련 코드 경로를 모두 확인했는가
- 권한/게스트 영향 범위를 확인했는가
- 타입과 UI 카피가 일치하는가
- 테스트/린트/빌드 검증을 했는가
- `docs/04-dev-log.md`를 갱신했는가
- 영향받는 `docs/*.md`를 함께 갱신했는가

### 9.2 DB Change Checklist

- `supabase/migrations/*.sql` 추가 또는 수정
- `supabase/schema.sql` 동기화 여부 확인
- RLS/RPC/index/trigger 영향 확인
- `docs/03-architecture.md` 갱신
- `docs/05-automation.md` 갱신
- `docs/04-dev-log.md` 기록

### 9.3 UI/UX Change Checklist

- 모바일 320px 기준에서 깨지지 않는가
- `AppBar + content(px-4)` 패턴을 지켰는가
- 기존 디자인 토큰을 재사용했는가
- 히스토리/상세 등 관련 가이드 문서를 갱신했는가

## 10. Known Current Product Truths

현재 문서/코드 기준으로 유지해야 하는 사실:

- 홈은 클럽 대시보드 성격이다.
- 초대 링크 경로는 `/join/[inviteCode]`다.
- 게스트 참가가 가능하다.
- 게스트는 경기 저장/수정이 불가능하다.
- 경기 결과는 저장 즉시 확정되지 않는다.
- 리더보드는 `confirmed` 경기만 집계한다.
- 히스토리는 카드/리스트 2가지 보기와 무한 스크롤을 제공한다.
- 주요 화면 레이아웃은 `AppBar + content(px-4)` 기준이다.

## 11. When In Doubt

판단이 애매하면 아래 원칙을 따른다.

1. 사용자 기록의 보존을 우선한다.
2. 권한은 넓게 열지 말고 보수적으로 유지한다.
3. UI보다 데이터/정책 일관성을 우선한다.
4. 문서를 미루지 말고 같은 작업에서 함께 수정한다.
5. 아키텍처/운영 규칙이 바뀌면 `docs/03`, `docs/05`, `docs/09`, `docs/04`를 우선 점검한다.

## 12. Agent Harness Roadmap

이 프로젝트는 단일 에이전트 사용을 넘어서, 역할 분리, 병렬 실행, 외부 도구 연결, 상태 추적, 자동화를 단계적으로 강화한다.
다만 도입 목표는 “최신 기능 많이 붙이기”가 아니라 “현재 제품을 더 정확하고 빠르게 운영하기”다.

원칙:
- 새 도구나 워크플로우를 도입하면 반드시 이 문서와 관련 `docs/`를 갱신한다.
- 실험 기능은 기본 개발 흐름을 깨지 않는 선에서만 사용한다.
- 외부 도구 연결은 보안, 재현성, 운영 비용을 먼저 검토한다.

### 12.1 Stage 1: Specialized Agents / Skills

목표:
- 하나의 범용 에이전트 대신 역할별 전문화를 사용한다.

현재 이 저장소에서 우선 사용할 역할:
- 제품/문서 정리 에이전트
- UI/UX 정리 에이전트
- Supabase/RLS 검토 에이전트
- 테스트/회귀 검토 에이전트
- 릴리즈 전 문서 정합성 검토 에이전트

실행 규칙:
- 문서 작업이 크면 제품 문서 역할로 분리해서 본다.
- DB/RLS/RPC가 포함되면 반드시 Supabase 검토 관점으로 한 번 더 확인한다.
- 테스트 추가나 회귀 점검이 필요하면 구현과 별도로 테스트 검토 관점을 둔다.
- 이미 세션에서 제공되는 local skill이 있으면 우선 사용한다.
- 외부 skill을 도입하면 설치 방법보다 “이 저장소에서 언제 쓰는지”를 먼저 문서화한다.

현재 적용 방식:
- 이 저장소는 이미 `AGENTS.md` + `docs/` + local skills 체계를 사용한다.
- 새 skill을 추가하면 아래를 함께 기록한다.
  - 목적
  - 호출 시점
  - 출력물 기대치
  - 충돌 가능한 기존 규칙

### 12.2 Stage 2: Agent Teams / Parallel Work

목표:
- 순차 작업을 줄이고 독립적인 탐색/검증을 병렬화한다.

실행 규칙:
- 파일 읽기, 로그 확인, 영향 범위 분석은 가능한 한 병렬화한다.
- 구현은 한 흐름으로 유지하되, 탐색과 검증은 병렬로 분리한다.
- 하나의 큰 작업은 최소한 아래 관점으로 분해할 수 있어야 한다.
  - 구현
  - 문서 영향
  - 검증/테스트

이 저장소 기본 패턴:
- 파일 탐색: `multi_tool_use.parallel`
- 검증: 가능하면 `test`, `lint`, `build`를 상황에 맞게 병렬 또는 연속 실행
- 문서 업데이트: 기능 구현 후가 아니라 같은 작업 범위 안에서 병행 검토

주의:
- 병렬화는 탐색과 확인에 쓰고, 충돌 가능한 파일 편집은 단일 흐름으로 처리한다.
- 서로 다른 에이전트가 같은 파일을 동시에 수정하는 구조는 피한다.

### 12.3 Stage 3: MCP / External Tool Integrations

목표:
- 로컬 코드와 Supabase만 보는 한계를 넘어서, 공식 문서/브라우저/저장소 관리 도구를 연결한다.

이 프로젝트에서 우선순위가 높은 외부 도구:
- 공식 문서 검색 도구
  - Next.js, Supabase, OpenAI, Radix/shadcn 참조 정확도 향상
- 브라우저 자동화 도구
  - 로그인, 초대 링크, 경기 생성, 승인 UX의 실제 흐름 점검
- GitHub 연동 도구
  - PR/이슈/릴리즈 노트 관리
- 라이브러리 문서 컨텍스트 도구
  - 버전별 API 차이 확인

도입 기준:
- 제품 코드 변경 품질에 직접 기여하는가
- 공식 문서나 실제 브라우저 상호작용이 필요한가
- 설치/유지 비용보다 반복 효용이 큰가

운영 규칙:
- MCP를 추가하면 `AGENTS.md`에 목적과 사용 시점을 적는다.
- 민감한 자격증명이나 production 권한이 필요한 도구는 별도 검토 전 기본 활성화하지 않는다.
- 브라우저 자동화 도구를 쓰면 재현 시나리오를 `docs/08-ux-tasks.md` 또는 별도 QA 문서에 남긴다.

### 12.4 Stage 4: Real-Time Monitoring

목표:
- 에이전트 상태, 문맥 사용량, 도구 호출 이력을 보면서 작업을 끊기지 않게 운영한다.

실행 규칙:
- 긴 작업에서는 중간 상태를 짧게 공유한다.
- 문맥이 길어질수록 현재 결정 사항을 문서에 압축 기록한다.
- 세션 의존 지식이 생기면 `AGENTS.md` 또는 `docs/04-dev-log.md`에 외부화한다.

이 저장소에서 특히 중요한 모니터링 대상:
- DB 적용 여부와 코드 상태의 불일치
- 문서와 구현 상태의 불일치
- 승인/권한 로직처럼 UI에서는 보이지만 실제 조건은 다른 흐름
- 자동화 스크립트와 실제 운영 절차의 어긋남

운영 기준:
- “세션 안에서는 알고 있지만 문서에는 없는 상태”를 만들지 않는다.
- 긴 기능 작업이 끝나면 최소한 `docs/04-dev-log.md`에 결정 사항을 남긴다.

### 12.5 Stage 5: Automation / Scheduling

목표:
- 반복적인 검증, 문서 점검, 운영 확인 작업을 수동 실행에서 자동 실행으로 옮긴다.

이 프로젝트에서 자동화 우선순위:
- 정기 검증
  - `npm run test`
  - `npm run lint`
  - `npm run build`
- DB 관련 점검
  - `npm run env:check`
  - `npm run db:smoke`
  - `npm run db:push:dry`
- 문서 정합성 점검
  - 최근 기능 변경 후 문서 미갱신 탐지
- UX 회귀 점검
  - 초대 링크 진입
  - 게스트 참가
  - 경기 저장
  - 확인 요청 처리

운영 규칙:
- 반복적으로 수동 실행하는 검증이 3회 이상 반복되면 자동화 후보로 본다.
- 자동화 결과는 작업 중인 파일을 직접 덮어쓰기보다, 검토 가능한 출력으로 남기는 방식을 우선한다.
- 자동화가 추가되면 아래를 함께 수정한다.
  - `docs/05-automation.md`
  - `docs/04-dev-log.md`
  - 필요 시 `README.md`

## 13. Adoption Order For This Repo

이 저장소는 아래 순서로 강화한다.

1. `AGENTS.md` + `docs/`를 source of truth로 유지
2. local skills와 역할 분리 사용
3. 병렬 탐색/검증을 기본 습관으로 고정
4. 공식 문서/브라우저/GitHub 중심 MCP를 신중하게 추가
5. 반복 검증과 QA를 자동화

즉, 지금 단계에서는 “무조건 도구를 많이 붙이는 것”보다 아래가 더 중요하다.
- 문서가 항상 최신인가
- 권한/확정/게스트 정책이 안 깨지는가
- 병렬 탐색과 검증을 잘 활용하는가
- 자동화 후보를 꾸준히 문서화하는가
