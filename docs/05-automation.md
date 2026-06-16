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

## CLI / External Tool Status

2026-05-07 로컬 확인 기준:

- Vercel CLI: `npx vercel` 사용 가능, 확인 버전 `50.26.1`
- Vercel project link: `.vercel/project.json` 존재, `minhyuns-projects/tournament-record` 프로젝트에 연결됨
- Vercel env: Production에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 등록 확인
- Supabase CLI: `npx supabase` 사용 가능, 확인 버전 `2.98.2`
- Supabase CLI auth: `npx supabase projects list`로 접근 가능한 프로젝트 목록 확인됨
- Supabase local link: 설정되어 있지 않음. `npx supabase projects list`는 `Cannot find project ref. Have you run supabase link?` 안내를 함께 출력한다.
- Supabase DB automation: 이 repo는 `supabase link` 대신 `SUPABASE_DB_PUSH_URL`/`SUPABASE_DB_URL`을 `--db-url`로 넘기는 방식이 표준이다.
- Supabase migration state: remote에는 `club_record` 본 migration 4개, 후속 보정/동기화 migration, 히스토리 게스트 이름 RPC 보정 migration, 히스토리 `team_names` migration, 미연결 클럽 멤버/계정 연결 migration이 반영되어 있으면 `npm run db:push:dry` 기대값은 `Remote database is up to date.`다.
- GitHub CLI: `gh`는 현재 설치되어 있지 않음
- GitHub access: GitHub MCP 인증과 `git` 원격 조회를 사용한다. 원격 저장소는 `m2nhyun/tournament-record`다.

현재 등록된 Codex MCP:

- `playwright`
- `context7`
- `exa`
- `github`
- `figma`

현재 미등록 MCP:

- Vercel MCP
- Supabase MCP

따라서 Vercel/Supabase 운영 확인은 MCP가 아니라 CLI와 이 문서의 npm scripts를 기준으로 한다.

## Auth Modes

- 운영 권장: Kakao OAuth + Email/Password 로그인
- 게스트 참가: 초대 링크(`/join/[inviteCode]`)에서 게스트 참가 허용
  - 게스트 권한: 조회/참가만 허용, 경기 생성/수정 불가
- 미연결 멤버: 운영진이 이름만으로 먼저 추가할 수 있으며, 정회원이 초대 링크로 들어와 같은 이름 후보를 확인한 경우 `claim_club_member_by_invite`로 기존 멤버 row와 연결한다.
  - `add_unclaimed_club_member`, `find_claimable_club_member_by_invite`, `claim_club_member_by_invite`는 `authenticated` 전용 RPC다. JWT-less `anon` 권한은 부여하지 않는다.
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
npm run db:smoke         # Supabase 연결 스모크 체크 (head/count)
npm run db:smoke:sql     # club_record 도메인 규칙 SQL smoke (psql 필요)
npm run db:push:dry      # 원격 DB 반영 예정 마이그레이션 확인
npm run db:push          # 원격 DB 마이그레이션 실제 반영 + schema.sql 동기화
npm run db:schema:sync   # 원격 public schema를 schema.sql로 다시 덤프
npm run verify           # test + lint + build 전체 검증
npm run automation:check # env + smoke + verify 일괄 실행
```

### QA Full-Club Scenario

`scripts/qa/full-club/` 하위에 24명 풀 클럽 e2e 자동화가 있다. 자세한 항목과 검증 매트릭스는 `docs/qa/full-club-scenario-2026-06-10.md` 참고.

```bash
# 사전: Docker 실행 + npx supabase start (로컬 인스턴스 가동)
npm run qa:full-club            # seed → scenario → cleanup 3단계 묶음
npm run qa:full-club:seed       # 24명 + 클럽 + 이벤트 시드 (로컬만)
npm run qa:full-club:scenario   # vitest e2e (vitest.e2e.config.ts)
npm run qa:full-club:cleanup    # 시드 데이터 + auth 사용자 제거 (로컬만)
npm run qa:full-club:smoke-prod # 운영 read-only (select head + RPC ping)
```

운영 안전:
- 시드/시나리오/cleanup은 `scripts/qa/full-club/use-local-supabase.sh`가 `npx supabase status` 기반으로 URL/키를 로컬로 강제 override한다. 운영 DB로 실수 진입 불가.
- `smoke-prod.mjs`는 read-only만 수행하고, URL이 로컬이면 즉시 종료한다.
- `npm run test` / `npm run verify`는 `scripts/qa/**`를 무시하도록 vitest/eslint/tsconfig가 격리되어 있다.

## Vercel CLI Operations

이 repo의 Vercel 운영 확인은 `npx vercel` 기준으로 한다.
Vercel MCP는 현재 등록되어 있지 않다.

비파괴 확인:

```bash
npx vercel --version
npx vercel whoami
npx vercel env ls
```

주의:
- `npx vercel env ls`는 연결된 `.vercel/project.json` 기준 프로젝트 env 목록을 보여준다.
- 현재 production env에는 Supabase URL/anon key/service role key가 등록되어 있다.
- 값은 encrypted로 표시되어야 하며, 문서나 로그에 실제 값을 남기지 않는다.
- `npx vercel env pull`은 `.env.local`을 만들거나 덮어쓸 수 있으므로 실행 전 목적을 확인한다.

배포:

```bash
npx vercel           # preview deployment
npx vercel --prod    # production deployment
```

운영 규칙:
- production 배포 전에는 `npm run verify`를 먼저 실행한다.
- env 변경이 필요한 작업은 Vercel Dashboard 또는 Vercel CLI로 반영하되, 실제 secret 값은 문서에 기록하지 않는다.
- Vercel env 구조나 배포 절차가 바뀌면 `docs/05-automation.md`와 `docs/04-dev-log.md`를 함께 갱신한다.
- 배포 URL, 배포 id, 로그 확인 결과는 필요할 때만 dev log에 요약하고 민감값은 제외한다.

## GitHub Access

이 repo의 GitHub 원격은 아래와 같다.

```bash
origin https://github.com/m2nhyun/tournament-record.git
```

현재 `gh` CLI는 설치되어 있지 않다.
PR/이슈/리포지토리 상태 확인은 GitHub MCP를 우선 사용하고, 단순 remote 접근 확인은 `git` 명령을 사용한다.

비파괴 확인:

```bash
git remote -v
git ls-remote --heads origin
```

운영 규칙:
- GitHub MCP는 `GITHUB_TOKEN`이 필요하며, 이 저장소에서는 `direnv`로 주입된 토큰을 기준으로 사용한다.
- `gh` CLI를 도입하면 설치/로그인/사용 시점을 이 문서와 `AGENTS.md`에 추가한다.
- push/PR/issue 변경은 사용자 요청이 명확할 때만 수행한다.

## 권장 실행 순서

1. `npm run env:check`
2. `npm run browser:check` (UI/라우트 변경 시)
3. `npm run db:smoke`
4. `npm run db:push:dry`
5. `npm run db:push`
6. `npm run verify`

## Club Record SQL Smoke

`club_record` migration 적용 뒤에는 아래 SQL smoke를 실행한다. 로컬에 `psql`이 있으면 wrapper를 우선 사용한다.

```bash
npm run db:smoke:sql
```

wrapper(`scripts/automation/smoke-db-sql.sh`)는 `SUPABASE_DB_PUSH_URL`(없으면 `SUPABASE_DB_URL`)로 `psql -v ON_ERROR_STOP=1 -f supabase/tests/club_record_smoke.sql`을 실행한다.

`psql`이 없으면 Docker Postgres client로 동일하게 실행한다.

```bash
source scripts/automation/source-env.sh
docker run --rm -i public.ecr.aws/supabase/postgres:17.6.1.106 \
  psql "$SUPABASE_DB_PUSH_URL" -v ON_ERROR_STOP=1 < supabase/tests/club_record_smoke.sql
```

주의:
- 이 스크립트는 `begin ... rollback`으로 감싸져 있어 테스트 데이터가 남지 않아야 한다.
- 실제 운영 DB에서 실행하기 전에는 로컬/스테이징에서 먼저 통과하는 것이 원칙이다. 2026-05-07에는 사용자가 `nomcsuizsztyhxkehila`가 1인 개발용 local/prod 공용 메인 DB임을 확인하고 명시 승인해 운영 DB apply/smoke를 수행했다.
- `SUPABASE_DB_PUSH_URL`가 remote pooler host로 해석되면 운영 DB일 수 있으므로, 운영 DB apply/smoke는 명시 승인 없이는 실행하지 않는다.
- 검증 범위는 confirmed 데이터 삭제 방지, event 취소/삭제 방지, linked participant 삭제 방지, 랭킹 이동 unique 충돌 방지, 클럽 회원 랭킹 동기화 RPC, cross-club 참가자 삽입 차단, 초대 게스트 참가 RPC, 늦참 슬롯 배정 방지, 비활성 멤버 권한 차단, overview 노출 범위, 게스트 결과 입력 차단, 회원/운영진 결과 입력 경로, 히스토리의 내 팀 전체 이름/게스트 표시명 포함, 월간 공개 카드 `win_rate` 0..100 scale, deleted/cancelled event의 월간 카드 집계 제외다.
- `npm run db:push:dry`만으로는 이 도메인 규칙을 검증하지 못하므로, migration 적용 후 별도 smoke로 취급한다.
- 로컬/스테이징에서만 먼저 실행한다. 실제 운영 DB apply 또는 운영 DB smoke 실행은 별도 승인 후 진행한다.

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

### Decision Tree

1. 새 SQL이 `supabase/migrations/*.sql`에 있다면 `npm run db:push:dry`로 먼저 확인한다.
2. dry-run 결과가 정상이고 remote migration history도 맞으면 `npm run db:push`로 반영한다.
3. `supabase migration list`에서 remote schema 객체는 이미 있는데 `Remote`가 비어 있으면, SQL을 다시 밀어 넣지 말고 `supabase migration repair ... --status applied`로 history부터 복구한다.
4. Supabase Dashboard에서 SQL을 직접 실행했거나 remote schema를 로컬 파일로 다시 맞춰야 하면 `npm run db:schema:sync`를 사용한다.
5. `db.<project-ref>.supabase.co:5432` direct host가 IPv6-only로 응답하면 `SUPABASE_DB_PUSH_URL`에 session pooler 문자열을 넣고 CLI 작업을 수행한다.

### Operating Rules

- DB 변경은 `npm run db:push:dry` 후 `npm run db:push`로 반영한다.
- `npm run db:push`는 적용 성공 뒤 `supabase/schema.sql`까지 자동으로 동기화한다.
- 코드/문서/SQL은 같은 변경 세트로 관리하고, SQL 적용 전까지 기능 완료로 보지 않는다.
- `db:push:dry`, remote schema dump, 핵심 RPC/컬럼 조회를 먼저 보고 나서 repair 여부를 결정한다.
- `SUPABASE_DB_PUSH_URL`가 있으면 `db:push`, `db:push:dry`, `db:schema:sync`는 이 값을 우선 사용한다.
- `SUPABASE_DB_PUSH_URL`는 remote Supabase pooler host를 가리킬 수 있다. 호스트명이 `pooler.supabase.com`인 것만으로 local/staging 안전성은 증명되지 않는다.
- `npm run db:push`와 `psql "$SUPABASE_DB_PUSH_URL" -f supabase/tests/club_record_smoke.sql`는 대상 DB가 disposable local/staging임을 문서나 환경 설정으로 명시 확인한 뒤에만 실행한다.
- 대상이 확인되지 않으면 실행을 멈추고 blocker로 기록한다.
- 비밀번호에 `@`, `:`, `/` 같은 reserved 문자가 있으면 URL 인코딩해야 한다. 예: `p@ssword` -> `p%40ssword`
- Supabase 공식 가이드 기준으로 direct connection은 IPv6 의존성이 있을 수 있으므로, 현재 네트워크에서 5432 direct 접속이 막히면 session pooler를 사용한다.
- 현재 기준 remote migration history와 `supabase/schema.sql`은 `club_record` 적용 후 정합 상태다.
- `npm run db:push:dry`의 현재 정상 기대값은 `Remote database is up to date.`다.
- 운영 DB에 새 migration을 추가 적용하거나 smoke를 다시 실행하려면 별도 명시 승인이 필요하다.

### Execution Order

1. `supabase/migrations/*.sql`에서 대상 파일 선택
2. `npm run db:push:dry`
3. remote schema는 이미 있는데 migration history만 비어 있으면 `supabase migration repair ... --status applied`
4. 그 외 일반적인 신규 변경이면 `npm run db:push`
5. 검증 쿼리 또는 앱 기능 재테스트
6. 대시보드에서 직접 실행했다면 `npm run db:schema:sync`
7. `docs/04-dev-log.md`에 실행 일시와 적용 파일 기록
8. 관련 문서(`docs/03-architecture.md`, `docs/05-automation.md`, 필요 시 `README.md`) 최신 상태 확인

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
