# Automation Guide

이 문서는 DB/검증/배포 관련 반복 작업을 명령어로 고정하기 위한 가이드다.

## 자동화 범위

자동화됨:
- 코드 품질 체크(`lint`, `build`)
- Supabase 연결 스모크 체크
- Supabase 마이그레이션 dry-run / apply
- GitHub Actions CI(푸시/PR 시 자동 검증)

수동 필요:
- Supabase Dashboard Auth 설정(Provider/Redirect)
- Vercel 환경변수 관리
- SQL Editor 수동 반영(현재 운영 정책)

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

예시:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'
```

## 명령어

```bash
npm run env:check        # 앱 필수 env 확인
npm run db:smoke         # Supabase 연결 스모크 체크
npm run db:push:dry      # 원격 DB 반영 예정 마이그레이션 확인
npm run db:push          # 원격 DB 마이그레이션 실제 반영
npm run verify           # lint + build 전체 검증
npm run automation:check # env + smoke + verify 일괄 실행
```

## 권장 실행 순서

1. `npm run env:check`
2. `npm run db:smoke`
3. `npm run db:push:dry`
4. `npm run db:push`
5. `npm run verify`

## Temporary Policy (Manual DB Migration)

- 원칙: DB 변경은 Supabase `SQL Editor` 수동 실행을 기본으로 유지한다.

실행 순서:
1. `supabase/migrations/*.sql`에서 대상 파일 선택
2. SQL Editor에 전체 붙여넣기 후 실행
3. 검증 쿼리 실행(함수/테이블/정책 생성 확인)
4. 앱 기능 재테스트
5. `docs/04-dev-log.md`에 실행 일시와 적용 파일 기록

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
