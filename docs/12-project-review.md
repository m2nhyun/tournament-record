# Tournament Record Project Review

작성일: 2026-05-14 (2026-06-08 갱신)
검토 범위: 제품 문서, App Router 구조, `src/features/*`, Supabase schema/migration, 자동화 스크립트, 테스트, UI/UX 규칙

> 2026-06-08 갱신 메모
>
> P0 IA 정리가 완료되었다: `/leaderboard` orphan 제거, `MatchConfirmationPromptCard` cross-track 진입점 제거, 용어 정의 추가. 본 리뷰 초기(2026-05-14) 및 2026-05-27 갱신 후 남았던 P0 IA 항목이 모두 해소됐다. 다음 우선순위는 P1(DB/권한 경계 보강).

## 목차

1. [읽는 방법](#읽는-방법)
2. [Executive Summary](#executive-summary)
3. [PCD Review](#pcd-review)
4. [현재 제품 구조](#현재-제품-구조)
5. [문서와 운영 규칙](#문서와-운영-규칙)
6. [Frontend / IA / UX](#frontend--ia--ux)
7. [Backend / DB / RLS](#backend--db--rls)
8. [Quality / Test / Automation](#quality--test--automation)
9. [Risk Register](#risk-register)
10. [권장 작업 순서](#권장-작업-순서)
11. [Release Readiness](#release-readiness)
12. [Appendix](#appendix)

## 읽는 방법

이 문서는 “지금 이 프로젝트가 어디에 있고, 다음에 무엇을 해야 하는가”를 사람이 빠르게 판단하기 위한 총괄 리뷰다.

코드의 세부 구현을 모두 설명하기보다, 제품 방향과 실제 구현, 문서, DB, 테스트가 서로 맞물리는지를 본다. 파일 단위 세부 설명은 기존 문서를 source of truth로 두고, 이 문서는 판단과 우선순위를 정리한다.

서술 순서는 PCD 흐름을 따른다.

- Purpose: 왜 이 제품을 만들고 있는가
- Context: 현재 구현과 운영 구조는 어떤 상태인가
- Diagnosis: 무엇이 잘 되어 있고, 어디가 어긋나 있는가
- Direction: 어떤 순서로 정리하면 좋은가

## Executive Summary

`tournament-record`는 현재 “개인 경기 기록 앱”보다 “테니스 클럽 운영진이 정모/데일리 매치 기록을 빠르게 남기는 운영 도구”에 가깝다. 문서상 제품 포지셔닝도 클럽 운영 중심이고, 실제 라우팅도 `/clubs/[clubId]`를 `club_record` 대시보드로 사용한다.

가장 강한 부분은 `club_record` 도메인이다. 별도 테이블군, RPC, smoke SQL, 자동 편성 유틸 테스트, 게스트 초대, 월간 카드, 히스토리 RPC까지 꽤 깊게 들어가 있다. 특히 “운영 DB 적용 후 smoke로 검증한 상태”가 문서에 남아 있어, DB 작업의 추적 가능성이 좋다.

가장 큰 정리 과제는 다음이다.

1. 제품 표면의 이중화 (해소됨, 2026-06-08)
   - `/clubs/[clubId]/leaderboard` 라우트와 `src/features/leaderboard/*`를 삭제했다.
   - `MatchConfirmationPromptCard`를 club_record 대시보드에서 제거하고 컴포넌트도 함께 삭제했다. 일반 경기 확인 요청은 `/history` 화면 자체의 `MatchConfirmationInboxAction`에서 처리한다.
   - legacy `/history`, `/matches/*`, `/schedules/*` 보조 트랙은 바텀 네비 미노출 + URL 직접 접근(또는 일정 카드 내부 링크)으로만 진입하는 닫힌 시스템으로 명문화됐다(`docs/01-product-canvas.md` 보조 트랙 섹션).

2. 검증 게이트 (해소됨, 2026-05-27 확인)
   - `.github/workflows/ci.yml`에 이미 test → lint → build 순서로 모두 포함되어 있다.
   - `package.json`의 `verify`는 `npm run test && npm run lint && npm run build`로 묶여 있다.
   - `db:smoke`, `db:smoke:sql`도 npm script로 승격되어 있다.

3. UI/UX 규칙과 남은 구현의 차이 (대부분 해소됨, 2026-05-27 확인)
   - native `<select>`: src 전체 grep 결과 0건.
   - native `<details>`: src 전체 grep 결과 0건.
   - `window.confirm`: 0건 (member 제외 1건이 마지막이었고 `AlertDialog`로 전환됨).

현재 상태는 제품적으로 “기능 골격은 상당히 많이 왔고, 운영 도구로 쓰기 시작할 수 있는 수준”이다. 다음 단계는 새 기능 추가보다 legacy IA 경계 정리(특히 cross-track 진입점), DB/RPC 트랜잭션 보강, 일정 호스트 액션/일정→경기 연결이 더 중요하다.

## PCD Review

### Purpose

제품의 한 줄 정의는 `docs/01-product-canvas.md` 기준으로 “아마추어 테니스 모임/클럽의 경기 기록을 쉽고 신뢰 가능하게 남기는 서비스”다.

현재 구현을 보면 목적은 더 좁고 선명해졌다.

- 운영진이 데일리 매치 이벤트를 만든다.
- 회원/게스트를 참가자로 넣는다.
- 자동 또는 수동으로 복식 경기를 편성한다.
- 결과를 입력하고 확정된 결과를 히스토리/월간 카드/랭킹에 반영한다.
- 멤버는 내 기록과 클럽 내 비교를 보며 재방문한다.

즉 현재 제품의 실질 목적은 “클럽 운영자가 정모 직후 기록을 빠르게 마감하고, 멤버가 신뢰 가능한 내 기록을 확인하는 것”이다.

### Context

현재 구현은 다음 네 축으로 구성된다.

- `auth`: Kakao/Email/anonymous session, 정회원 프로필 온보딩
- `clubs`: 클럽 생성, 초대, 멤버, 설정, 일정 진입
- `matches`: 기존 일반 경기 기록, 확인 요청, 히스토리, 리더보드
- `club-record`: 현재 메인 운영 도메인. 데일리 매치 이벤트, 참가자, 게스트, 편성, 결과, 월간 카드, 랭킹

App Router 기준 핵심 IA는 다음과 같다.

- 홈: `/clubs/[clubId]`
- 이벤트: `/clubs/[clubId]/club-record/events`
- 히스토리: `/clubs/[clubId]/club-record/history`
- 클럽: `/clubs/[clubId]/club`

이 구조는 `docs/03-architecture.md`, `docs/club-record/07-handoff.md`, `src/components/layout/bottom-nav.tsx`와 대체로 일치한다.

### Diagnosis

좋은 점은 다음과 같다.

- 제품 방향이 실제 라우팅에 반영되어 있다.
- `club_record`는 DB/RPC/service/UI/test 문서가 비교적 밀도 있게 연결되어 있다.
- DB 작업 정책이 명확하다. `db:push:dry`, `db:push`, `schema.sql sync`, smoke SQL 흐름이 문서화되어 있다.
- 권한 정책이 보수적이다. 게스트는 조회/참가 중심이고 생성/수정은 제한한다.
- 디자인 규칙이 최근에 프로젝트 전용으로 정리되었다.

어긋난 점은 다음과 같다.

- `docs/01-product-canvas.md`의 MVP 설명은 아직 일반 경기 기록 중심으로 읽힌다.
- `club_record`가 메인인데 legacy 일반 경기 경로가 제품 표면에 남아 있어 사용자가 “어느 히스토리/랭킹이 진짜인가”를 헷갈릴 수 있다.
- `docs/club-record/README.md` 일부 open item은 handoff의 완료 상태와 충돌할 수 있다.

> 이전에 P0/P1로 기록되어 있던 다음 항목은 2026-05-27 기준 모두 해소되었다.
> - `npm run test`가 CI에 없음 → `.github/workflows/ci.yml`에 추가됨
> - `verify`에 test 누락 → `npm run test && npm run lint && npm run build`로 통합됨
> - `packageManager`가 pnpm → `npm@10.9.2`로 고정됨
> - `eslint-config-next` 버전 미일치 → `^16.2.6`로 동기화됨
> - club_record SQL smoke 미승격 → `db:smoke:sql` npm script로 승격됨
> - native `<select>` 잔존 → src 전체 0건
> - `window.confirm`/native `<details>` 잔존 → club-record/매치 컨트롤 영역에서 모두 제거됨

### Direction

다음 방향은 “넓게 새 기능 추가”가 아니라 “운영 가능한 MVP로 수렴”이다.

우선순위는 아래 순서가 합리적이다.

1. IA와 legacy 경계 확정
   - `/history`, `/leaderboard`, `/matches/new`를 유지/폐기/흡수 중 하나로 결정
   - 확인 요청 카드가 어느 히스토리로 가야 하는지 정리

2. DB/RLS 고위험 경계 강화
   - core match create/update/approve/reject를 RPC transaction으로 옮길지 결정
   - anon/default privileges 재검토
   - `profile_completed` DB 강제 여부 결정 (현재는 서비스 계층 `requireCompletedProfile`만, DB 정책은 없음)

3. 제품 문서 최신화
   - `01-product-canvas.md`를 현재 `club_record` 중심 제품 shape에 맞게 갱신
   - 완료된 review finding과 open item 정리

> 완료된 항목: 품질 게이트(CI test/verify/SQL smoke), UI primitive 통일(native select/confirm/details 제거). 자세한 내용은 위 Executive Summary 참고.

## 현재 제품 구조

### 제품 포지션

현재 제품은 클럽 운영진을 1차 고객으로 둔다. 개인 선수가 혼자 쓰는 기록장이 아니라, 클럽 단위의 경기 운영 기록을 남기는 플랫폼이다.

운영진 관점의 핵심 작업은 다음과 같다.

- 이벤트 생성
- 클럽 회원/게스트 참가자 추가
- 자동 편성 또는 수동 경기 생성
- 결과 입력/수정
- 월간 카드와 랭킹 확인

멤버 관점의 핵심 작업은 다음과 같다.

- 내 기록 확인
- 경기 결과 확인 요청 처리
- 클럽 내 활동/순위 확인
- 일정 참가

게스트 관점의 핵심 작업은 다음과 같다.

- 초대 링크로 진입
- 닉네임/프로필 입력
- 이벤트 참가
- 경기 조회

### 라우트 구조

현재 클럽 내부의 주요 라우트는 다음처럼 읽힌다.

| 영역 | 라우트 | 현재 역할 |
| --- | --- | --- |
| 홈 | `/clubs/[clubId]` | `club_record` 운영 대시보드 |
| 이벤트 | `/clubs/[clubId]/club-record/events` | 데일리 매치 이벤트 목록 |
| 새 이벤트 | `/clubs/[clubId]/club-record/new` | 운영진 이벤트 생성 |
| 이벤트 워크스페이스 | `/clubs/[clubId]/club-record/[eventId]` | 참가자/편성/결과 운영 |
| 히스토리 | `/clubs/[clubId]/club-record/history` | 내 club_record 기록 |
| 월간 카드 | `/clubs/[clubId]/club-record/monthly` | 월간 공개 카드 상세 |
| 랭킹 | `/clubs/[clubId]/club-record/ranking` | 클럽 회원 랭킹 관리 |
| 클럽 | `/clubs/[clubId]/club` | 클럽 정보/초대/일정/멤버 관리 |
| 기존 경기 | `/clubs/[clubId]/matches/*` | legacy 일반 경기 기록 (보조 트랙) |
| 기존 히스토리 | `/clubs/[clubId]/history` | 일반 경기 히스토리 + 확인 인박스 (보조 트랙) |

보조 트랙 라우트(`/history`, `/matches/*`, `/schedules/*`)는 바텀 네비에 노출하지 않고, URL 직접 접근 + 일정 카드 내부 링크로만 진입하는 닫힌 시스템이다(`docs/01-product-canvas.md` 용어 정의 참조). `/leaderboard`는 2026-06-08 제거됨.

### 주요 도메인

`club_record`는 현재 가장 성숙한 도메인이다.

- 테이블: `club_record_settings`, `club_record_members`, `club_record_guest_profiles`, `club_record_events`, `club_record_guest_invites`, `club_record_event_participants`, `club_record_event_slots`, `club_record_matches`, `club_record_match_players`, `club_record_match_results`
- 서비스: `src/features/club-record/services/*`
- UI: `src/features/club-record/components/*`
- 유틸 테스트: `score`, `slots`, `assignment-pool`, `assignment-board`, `auto-assignment`, `access`, `date`
- SQL smoke: `supabase/tests/club_record_smoke.sql`

기존 `matches` 도메인은 상대 확인, 히스토리, 리더보드의 원형을 제공하지만 현재 메인 제품 경험에서는 보조/legacy에 가깝다.

`schedules` 도메인은 “일정 모집”으로 별도 성장 가능성이 있다. 현재는 클럽 탭과 새 경기 화면에 연결되어 있으나, `이벤트`, `일정`, `새 경기`라는 용어 경계가 아직 사용자에게 선명하지 않다.

## 문서와 운영 규칙

### 잘 되어 있는 점

문서 체계는 이 프로젝트의 큰 강점이다.

- `AGENTS.md`: 작업 운영 규칙과 자동 문서 갱신 규칙
- `docs/00-map.md`: 문서 지도
- `docs/01-product-canvas.md`: 제품 방향
- `docs/02-design-system.md`: UI 규칙
- `docs/03-architecture.md`: 구조와 권한
- `docs/05-automation.md`: DB/검증/배포 자동화
- `docs/09-keep-rules.md`: 비협상 규칙
- `docs/club-record/*`: club_record 세부 설계와 handoff

특히 `AGENTS.md`의 문서 갱신 규칙은 실무적으로 중요하다. 기능 구현, DB 변경, UI 변경, 운영 절차 변경이 문서와 함께 움직이도록 강제한다.

### 정리해야 할 점

`docs/01-product-canvas.md`는 현재 구현보다 한 단계 뒤에 있다. 문서의 MVP 범위는 일반 경기 기록/상대 확인/리더보드 중심인데, 실제 앱은 이미 `club_record` 이벤트 운영이 홈의 중심이다.

`docs/club-record/README.md`와 `docs/club-record/07-handoff.md` 사이에는 완료 상태 표현 차이가 있다. `07-handoff.md`는 review finding 상당수가 완료/통과라고 말하고, README는 일부를 open item처럼 읽히게 한다.

`profile_completed` 가드도 표현을 분리해야 한다. 현재 서비스 레벨 가드는 연결되어 있지만 DB/RPC 수준 전면 강제는 후속 범위다. 문서에서 이 둘을 한 문장 안에 섞으면 구현 상태를 오해할 수 있다.

## Frontend / IA / UX

### 강점

클럽 내부 기본 IA는 명확하다.

- 홈: 운영 상태와 현재 이벤트
- 이벤트: 데일리 매치 목록과 워크스페이스
- 히스토리: 개인 기록
- 클럽: 정보/초대/일정/멤버/랭킹 관리

대부분의 주요 화면은 `AppBar + px-4` 레이아웃을 따른다. 모바일 앱형 구조로서 일관성이 있다.

권한 기반 CTA 노출도 잘 되어 있다. 이벤트 생성, 참가자 관리, 결과 입력, 랭킹 관리 등은 role/capability에 따라 보이거나 숨겨진다.

경기 기록 UX는 타이핑보다 선택형을 우선한다. 점수 입력도 버튼 스텝퍼로 바뀌어 현장 입력에 더 맞다.

### 마찰

UI primitive 정합성은 2026-05-27 기준 거의 해소됐다.

- native `<select>`: src 전체 0건. `ClubRecordTimeSelect`(Popover 기반)와 `DropdownMenu`/`Popover`로 모두 교체됨.
- native `<details>`: src 전체 0건. 경기 메뉴는 `DropdownMenu`로 통합됨.
- `window.confirm`: 운영진 위험 액션(이벤트 취소/경기 삭제/확정 결과 덮어쓰기) 영역에서 0건. `AlertDialog`로 전환됨.
- `club-record-history`: 카드/리스트/필터 + `PAGE_SIZE=16` + `IntersectionObserver` sentinel 기반 무한 스크롤 구현됨.

남은 정리 후보는 IA/제품 경계 쪽이다. 운영진 위험 액션이 늘어날 경우 동일한 `AlertDialog` 패턴 유지가 핵심이고, 새 native control이 들어오지 않도록 디자인 규칙(`docs/design/00-ui-ux-agent-rules.md`)으로 가드한다.

### 용어 경계

현재 사용자에게 혼동될 수 있는 용어는 다음이다.

- `이벤트`: club_record 데일리 매치
- `일정`: 사전 모집/참가
- `새 경기`: 기존 경기 기록 또는 일정 잡기 진입
- `히스토리`: club_record 내 기록 또는 일반 경기 히스토리

이 네 용어는 제품 성장에 따라 계속 부딪힐 수 있다. 다음 IA 작업에서는 용어를 먼저 고정하는 것이 좋다.

## Backend / DB / RLS

### 강점

`club_record`는 DB 경계가 잘 잡혀 있다. 자동 편성, 수동 경기 생성, 결과 입력/수정, 게스트 초대 참가, 히스토리 조회, 월간 카드가 RPC와 RLS 경계로 묶인다.

SQL smoke도 단순 연결 확인이 아니라 실제 도메인 규칙을 검증한다.

- confirmed match 삭제 방지
- confirmed event 취소/삭제 방지
- linked participant 삭제 방지
- ranking move unique collision 방지
- 게스트 초대 참가
- cross-club participant insert 차단
- 비활성 멤버 권한 차단
- 게스트 결과 입력 차단
- 히스토리의 게스트 이름과 `team_names`
- 월간 카드의 deleted/cancelled event 제외

DB 운영 절차도 좋다. `SUPABASE_DB_PUSH_URL`, pooler 우회, `db:push:dry`, `db:push`, `schema.sql sync`가 문서와 script로 정리되어 있다.

### 리스크

기존 `matches` 도메인은 여러 client-side DML을 순차 실행한다. 경기 생성/수정/확정 과정에서 중간 실패나 동시 승인 race가 생길 수 있다. `club_record`처럼 핵심 쓰기를 RPC transaction으로 옮기면 안정성이 올라간다.

RLS는 켜져 있지만 `schema.sql` 기준 anon/default grant가 넓다. RLS와 함수 내부 guard가 최종 방어선이므로, 하나의 policy 실수가 blast radius를 키울 수 있다. `sync_club_record_members`처럼 명시적인 revoke/grant 패턴을 더 넓게 적용하는 것이 좋다.

`profile_completed`는 현재 서비스 계층 가드다. DB/RPC를 직접 호출하는 우회 경로까지 막지는 않는다. 이것을 제품 정책으로 충분하다고 볼지, DB에서도 강제할지 결정해야 한다.

감사 로그는 기존 match에는 있지만 `club_record` 전반에는 균일하지 않다. 랭킹, 이벤트 취소, 결과 수정, 게스트 초대 재발급 같은 운영 이벤트는 감사 정책이 필요하다.

## Quality / Test / Automation

### 현재 상태

테스트 파일은 총 16개이며, 주로 순수 유틸과 일부 서비스 에러 매핑을 다룬다.

잘 커버되는 영역은 다음이다.

- `club_record` 자동 편성/슬롯/점수/권한 유틸
- 기존 match helper/status/permission/filter
- auth 일부
- uuid validation

부족한 영역은 다음이다.

- React 컴포넌트 테스트
- 사용자 플로우 E2E
- Supabase service mock 테스트
- core match/schedule/profile SQL smoke

### CI / 검증 게이트

2026-05-27 기준 `.github/workflows/ci.yml`은 `npm ci` 다음에 `test → lint → build` 순서를 실행한다.

`package.json`의 `verify`는 `npm run test && npm run lint && npm run build`로 묶여 있다.

권장 로컬 게이트는 다음과 같다.

```bash
npm run verify
npm run env:check
npm run db:push:dry
```

DB/RLS/RPC 변경이 있으면 추가로 다음을 별도 승인된 대상에서 실행한다(또는 wrapper `npm run db:smoke:sql`).

```bash
psql "$SUPABASE_DB_PUSH_URL" -v ON_ERROR_STOP=1 < supabase/tests/club_record_smoke.sql
```

### 패키지/의존성 상태

dependency audit 대응 결과는 다음과 같다.

- `next`: `16.2.6` 정합
- `eslint-config-next`: `^16.2.6`로 next와 동기화
- `packageManager`: `npm@10.9.2`로 고정, scripts/CI/docs와 일관
- high severity audit은 해결됨
- 남은 moderate audit은 `next@16.2.6` 내부 `postcss@8.4.31`
- `npm audit fix --force`는 `next@9.3.3` 다운그레이드를 제안하므로 적용하면 안 됨

## Risk Register

2026-05-27 갱신: 해소된 항목은 표 아래 별도로 분리했다.

### 미해결

| 우선순위 | 리스크 | 영향 | 근거/위치 | 권장 대응 |
| --- | --- | --- | --- | --- |
| P1 | core match 쓰기 다중 DML | partial write, race condition | `src/features/matches/services/matches.ts` | RPC transaction화 검토 |
| P1 | anon/default grant 넓음 | RLS 실수 시 노출 범위 확대 | `supabase/schema.sql` | least privilege audit |
| P1 | `profile_completed` DB 미강제 | 서비스 계층 우회 시 정책 누락 가능 | `docs/11-auth-onboarding-design.md` | DB/RPC 강제 여부 결정 |
| P2 | service test 부족 | Supabase 호출 회귀를 build가 못 잡음 | `src/features/*/services` | mock client 기반 테스트 추가 |

### 해소됨

| 원래 우선순위 | 항목 | 해소 상태 |
| --- | --- | --- |
| P0 | `/leaderboard` orphan 라우트 | 라우트 + `features/leaderboard/*` 삭제 (2026-06-08) |
| P0 | `MatchConfirmationPromptCard` cross-track 진입 | club_record 대시보드에서 제거 + 컴포넌트 삭제 (2026-06-08) |
| P0 | legacy 히스토리/리더보드와 club_record 공존 | leaderboard 제거 + `/history`,`/matches/*` 보조 트랙 정책 명문화 (2026-06-08) |
| P2 | 제품 캔버스가 현재 구현보다 오래됨 | 용어 정의 추가 + 보조 트랙 진입 경로 갱신 (2026-06-08) |
| P0 | CI에 `npm run test` 없음 | `.github/workflows/ci.yml`에 test 단계 존재 (2026-05-27) |
| P0 | native select 잔존 | src/ 전수 grep 결과 0건 (2026-05-27) |
| P1 | SQL smoke 수동성 | `db:smoke`, `db:smoke:sql` npm script 존재 (2026-05-27) |
| P1 | 위험 액션 native confirm | `window.confirm` 0건 (2026-05-27) |
| P1 | `packageManager` 불일치 | `package.json`은 `npm@10.9.2`로 명시 (2026-05-27) |
| P1 | native `<details>` 메뉴 | src/ 전수 grep 결과 0건 (2026-05-27) |
| P0 | `eslint-config-next` 버전 불일치 | `next@16.2.6`과 정합 (2026-05-27) |

## 권장 작업 순서

### P0. 릴리즈 안전성 고정 (해소됨, 2026-05-27)

원래 항목(CI test, verify 묶음, eslint-config-next 정렬, npm 일관성)은 모두 해소되었다. 자세한 검증은 위 Risk Register §해소됨 참조.

### P0. IA 충돌 제거 (해소됨, 2026-06-08)

- `/leaderboard` 라우트 + `features/leaderboard/*` 삭제
- `MatchConfirmationPromptCard`를 club_record 대시보드에서 제거 + 컴포넌트 파일 삭제 (옵션 B 채택: legacy 매치 확인은 `/history` 화면의 inbox 액션으로만 처리하는 닫힌 시스템)
- `이벤트` / `일정` / `새 경기` / `club_record 히스토리` / `일반 경기 히스토리` 용어 정의를 `docs/01-product-canvas.md`에 추가
- 보조 트랙(`/history`, `/matches/*`, `/schedules/*`) 진입 경로를 "바텀 네비 미노출 + URL 직접 접근 + 일정 카드 내부 링크" 닫힌 시스템으로 명문화

### P1. UI primitive 정리 (해소됨, 2026-05-27)

native select, native `<details>`, `window.confirm`은 모두 0건. 새 규칙 위반은 PR 단계에서 grep 게이트만 유지하면 회귀를 막을 수 있다.

### P1. DB / 권한 경계 보강

1. core match 생성/수정/확정 RPC화 여부 결정
2. profile completion DB 강제 여부 결정
3. anon/default grant audit
4. audit log 정책 표준화
5. core match/schedule/profile SQL smoke 추가

이 단계의 목표는 “서비스 계층이 우회되어도 DB가 제품 규칙을 지키게 하는 것”이다.

### P2. 사용성 고도화

1. 월간 카드 상세 브라우저 검증
2. 결과 입력 플로우 E2E
3. 초대 링크/게스트 참가 E2E
4. 일정에서 실제 경기 기록으로 연결

> club_record 히스토리 무한 스크롤은 2026-05-19 이후 `PAGE_SIZE=16 + IntersectionObserver` sentinel로 구현됨(`club-record-history.tsx`).

이 단계의 목표는 “운영자가 실제 정모 후 반복 사용해도 마찰이 적은 상태”다.

## Release Readiness

현재 상태를 한 문장으로 말하면 다음과 같다.

`club_record` 중심 MVP는 기능적으로 꽤 가까워졌지만, 릴리즈 기준으로는 품질 게이트와 IA 정리가 먼저 필요하다.

릴리즈 전 최소 조건은 다음으로 보는 것이 합리적이다.

- `npm run verify`(test + lint + build)가 CI에서 통과한다.
- DB 변경이 있다면 `db:push:dry`와 `db:smoke:sql`이 통과한다.
- legacy 히스토리/리더보드 진입 정책이 문서화된다.
- dependency audit high severity는 0을 유지한다.

현재 이미 만족하는 조건은 다음이다.

- `npm run test`/`lint`/`build`가 CI에서 모두 실행된다.
- `club_record` DB apply/smoke 이력이 문서화되어 있다.
- `club_record` 핵심 유틸 테스트가 존재한다.
- Next high severity audit은 `16.2.6` 업그레이드로 해소되었다.
- native `<select>`/`<details>`/`window.confirm`이 운영 핵심 화면에서 제거되었다.
- 주요 제품 규칙은 `AGENTS.md`, `docs/09-keep-rules.md`, `docs/club-record/*`에 남아 있다.

아직 미흡한 조건은 다음이다.

- core match 다중 DML의 RPC 트랜잭션화 결정 미정
- `profile_completed` DB 강제 여부 미정
- service mock 테스트 부족

## Appendix

### 주요 참조 문서

- `AGENTS.md`
- `docs/00-map.md`
- `docs/01-product-canvas.md`
- `docs/02-design-system.md`
- `docs/03-architecture.md`
- `docs/05-automation.md`
- `docs/08-ux-tasks.md`
- `docs/09-keep-rules.md`
- `docs/club_record.md`
- `docs/club-record/07-handoff.md`
- `docs/club-record/08-review-findings.md`
- `docs/design/00-ui-ux-agent-rules.md`

### 주요 코드 경로

- `src/app/clubs/[clubId]/*`
- `src/components/layout/bottom-nav.tsx`
- `src/features/club-record/*`
- `src/features/matches/*`
- `src/features/schedules/*`
- `src/features/clubs/*`
- `supabase/migrations/*`
- `supabase/tests/club_record_smoke.sql`
- `.github/workflows/ci.yml`
- `scripts/automation/*`

### 이번 리뷰에서 직접 확인한 정량 정보

- `src` TypeScript/TSX 총량: 약 18,632 lines
- `docs` Markdown 총량: 약 5,502 lines
- `supabase/schema.sql` + migrations 총량: 약 10,516 lines
- 테스트 파일: 16개
- 주요 테스트 도메인: auth, club-record utils, match utils, validation, error mapping

### 이번 리뷰의 한계

- 원격 DB에 `db:push:dry`를 실행하지 않았다.
- 운영 DB smoke를 실행하지 않았다.
- 실제 모바일 브라우저 전체 플로우를 새로 순회하지 않았다.
- 현재 문서는 정적 코드/문서/스키마 읽기와 기존 검증 기록을 기반으로 한다.

