# Automation Guide

이 문서는 DB/검증/배포 관련 반복 작업을 명령어로 고정하기 위한 가이드다.

## 자동화 범위

자동화됨:
- 코드 품질 체크(`lint`, `build`)
- `cmux browser` 기반 페이지 스모크 체크
- Supabase 연결 스모크 체크
- Supabase 마이그레이션 dry-run / apply
- `schema.sql` 원격 스키마 동기화
- GitHub Actions CI(푸시/PR 시 자동 검증)

수동 필요:
- Supabase Dashboard Auth 설정(Provider/Redirect)
- Vercel 환경변수 관리
- SQL 반영 후 `docs/04-dev-log.md` 기록

## Auth Modes

- 운영 권장: Kakao OAuth + Email/Password 로그인
- 게스트 참가: 초대 링크(`/join/[inviteCode]`)에서 게스트 참가 허용
  - 게스트 권한: 조회/참가만 허용, 경기 생성/수정 불가
- 개발 편의 옵션: `NEXT_PUBLIC_ALLOW_GUEST_MODE=true`
  - 홈에서 자동 게스트 세션 생성
  - 운영 배포에서는 기본 `false` 권장

## Kakao Auth Setup

Supabase:
1. `Authentication > Sign In / Providers > Third-Party Auth > Kakao` 활성화
2. Kakao Client ID/Secret 입력
3. Redirect URL 추가

Kakao Developers:
1. 플랫폼: Web 등록 (`http://localhost:3000`, 운영 도메인)
2. Redirect URI에 Supabase callback 등록
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. 동의항목(프로필/이메일) 설정

## Environment Strategy

- Supabase는 단일 프로젝트로 운영한다.
- `main/develop` 분리는 Git/Vercel에서 처리한다.
- DB 변경은 항상 `db:push:dry` 선검증 후 반영한다.

## 선행 조건

1. `.env.local` 설정
2. `SUPABASE_DB_URL` 환경변수 설정
3. IPv4-only 환경이거나 direct DB host(`db.<project-ref>.supabase.co:5432`)가 막히면 `SUPABASE_DB_PUSH_URL`에 session pooler URL 설정

예시:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<url-encoded-password>@db.<project-ref>.supabase.co:5432/postgres'
export SUPABASE_DB_PUSH_URL='postgresql://postgres.<project-ref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
```

주의:
- 비밀번호에 `@`, `:`, `/` 같은 reserved 문자가 있으면 URL 인코딩해야 한다. 예: `p@ssword` -> `p%40ssword`
- `SUPABASE_DB_PUSH_URL`가 있으면 `db:push`, `db:push:dry`, `db:schema:sync`는 이 값을 우선 사용한다.
- Supabase 공식 가이드 기준으로 direct connection은 IPv6 의존성이 있을 수 있으므로, 현재 네트워크에서 5432 direct 접속이 막히면 session pooler를 사용한다.

## 명령어

```bash
npm run browser:check   # cmux browser로 페이지 접속/스냅샷 확인
npm run env:check        # 앱 필수 env 확인
npm run db:smoke         # Supabase 연결 스모크 체크
npm run db:push:dry      # 원격 DB 반영 예정 마이그레이션 확인
npm run db:push          # 원격 DB 마이그레이션 실제 반영 + schema.sql 동기화
npm run db:schema:sync   # 원격 public schema를 schema.sql로 다시 덤프
npm run verify           # lint + build 전체 검증
npm run automation:check # env + smoke + verify 일괄 실행
```

## 권장 실행 순서

1. `npm run env:check`
2. `npm run browser:check` (UI/라우트 변경 시)
3. `npm run db:smoke`
4. `npm run db:push:dry`
5. `npm run db:push`
6. `npm run verify`

## Browser QA (cmux)

- 기본 브라우저 QA는 `cmux browser`를 사용한다.
- 기본 대상은 `http://localhost:3000`이고, 필요 시 아래 env로 작업 라우트를 지정한다.

```bash
CMUX_BROWSER_URL=http://localhost:3000/clubs/<clubId>/schedules/<scheduleId> \
CMUX_BROWSER_EXPECT_TEXT="참가자" \
npm run browser:check
```

- 스크립트는 현재 cmux workspace의 browser surface를 재사용하고, 없으면 새 surface를 만든다.
- 확인 결과로 workspace, surface, title, url, compact snapshot을 출력한다.
- 인증이나 fixture가 없어 목표 라우트를 완전히 재현하지 못하면, 그 blocker를 작업 결과에 명시한다.

## DB Apply Policy

- 기본 원칙: DB 변경은 `npm run db:push:dry` 후 `npm run db:push`로 반영한다.
- `npm run db:push`는 적용 성공 뒤 `supabase/schema.sql`까지 자동으로 동기화한다.
- 대시보드에서 SQL을 수동 실행했다면 `npm run db:schema:sync`로 로컬 스키마를 다시 맞춘다.
- 코드/문서/SQL은 같은 변경 세트로 관리하고, SQL 적용 전까지 기능 완료로 보지 않는다.
- 현재 작업 환경처럼 `db.<project-ref>.supabase.co:5432` direct host가 IPv6-only로 응답하면, 대시보드의 session pooler 문자열을 `SUPABASE_DB_PUSH_URL`에 넣고 CLI 작업을 수행한다.
- remote schema 객체는 이미 있는데 `supabase migration list`의 `Remote`가 비어 있으면, SQL을 다시 밀어 넣지 말고 `supabase migration repair ... --status applied`로 history부터 복구한다.
- history repair 전에는 `db:push:dry`, remote schema dump, 핵심 RPC/컬럼 조회로 실제 schema가 최신 상태인지 먼저 확인한다.

실행 순서:
1. `supabase/migrations/*.sql`에서 대상 파일 선택
2. `npm run db:push:dry`
3. `npm run db:push`
4. 검증 쿼리 또는 앱 기능 재테스트
5. 대시보드에서 직접 실행했다면 `npm run db:schema:sync`
6. `docs/04-dev-log.md`에 실행 일시와 적용 파일 기록
7. 관련 문서(`docs/03-architecture.md`, `docs/05-automation.md`, 필요 시 `README.md`) 최신 상태 확인

## Required SQL (Current Baseline)

아래 마이그레이션은 현재 기능 기준으로 반드시 반영되어야 한다.

1. `20260306114000_add_guest_invite_policy_and_match_permissions.sql`
- `guest` role 추가
- `invite_expires_at`/재발급 함수
- 게스트 경기 권한 제한

2. `20260306123000_add_member_soft_removal_and_guest_message.sql`
- `club_members.is_active`, `left_at`
- 멤버 소프트 삭제 함수 `remove_club_member`
- active 멤버 기준 권한 함수 갱신

3. `20260310120000_add_match_delete_policy.sql`
- 경기 삭제 정책 보강
- match 관리 권한과 삭제 권한 일치

4. `20260310133000_add_match_confirmations.sql`
- `match_confirmations` 테이블 추가
- 확인 대상 승인/거절 상태(`pending | approved | rejected`) 도입
- 상대 확인 기반 경기 확정 흐름 지원

5. `20260319185807_update_match_schedule_host_toggle.sql`
- 일정 생성 RPC에 `본인 포함` 옵션 추가
- 개설자를 자동 참가자로 넣을지 여부를 일정 생성 시 결정

6. `20260319194000_add_match_schedule_end_time.sql`
- 일정 엔티티에 종료 시각(`ends_at`) 추가
- 일정 생성 RPC가 시작/종료 시각을 함께 받도록 확장
- 시간 슬롯 다중 선택 기반 범위 저장 지원

7. `20260402120000_add_user_profiles.sql`
- 전역 정회원 프로필 테이블 `user_profiles` 추가
- `display_name`, `gender`, `profile_completed`, `auth_provider` 저장
- 본인 전용 RLS(`select/insert/update own`) 추가

## Match Confirmation Operations

- 경기 저장 직후 기본 상태는 `submitted`다.
- 확인 대상 전원이 승인해야 `confirmed`로 전환된다.
- 한 명이라도 거절하면 `disputed`로 전환된다.
- 리더보드는 `confirmed` 경기만 집계한다.
- 이 플로우를 바꾸면 아래 문서를 함께 갱신한다.
  - `docs/03-architecture.md`
  - `docs/09-keep-rules.md`
  - `docs/10-history-ui-guidelines.md`
  - `docs/04-dev-log.md`

## Schema Change Notice

- 아래 항목이 바뀌면 작업 종료 시 사용자에게 명시적으로 알린다.
  - `supabase/migrations/*.sql`
  - `supabase/schema.sql`
  - RPC / RLS / enum / trigger / index
- 보고 형식은 최소 아래를 포함한다.
  - 스키마 변경 있음/없음
  - 변경 파일
  - 사용자 수동 반영 필요 여부
