# Automation Guide

이 문서는 "수동 SQL 실행"을 줄이고, 반복 작업을 명령어로 고정하기 위한 가이드다.

## 자동화 범위

자동화됨:
- 코드 품질 체크(`lint`, `build`)
- Supabase 연결 스모크 체크
- Supabase 마이그레이션 dry-run / apply
- GitHub Actions CI(푸시/PR 시 자동 검증)

수동 필요:
- Supabase Dashboard의 Auth 설정 변경(카카오 Provider 값)
- Vercel 대시보드 환경변수 값 입력/회전

## Auth Modes

- 운영 권장: Kakao OAuth + Email/Password 로그인
- 개발 편의: `NEXT_PUBLIC_ALLOW_GUEST_MODE=true` 설정 시 자동 게스트 세션 생성
  - 카카오 연동 전 UI/기능 테스트용
  - 운영 배포에서는 `false` 유지 권장

## Kakao Auth Setup

Supabase:
1. `Authentication > Sign In / Providers > Third-Party Auth > Kakao` 활성화
2. Kakao Client ID/Secret 입력
3. Redirect URL 추가

Kakao Developers:
1. 플랫폼: Web 등록 (`http://localhost:3000`, `https://tournament-record-vercel.vercel.app`)
2. Redirect URI에 Supabase callback 등록
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. 동의항목(이메일/프로필) 설정

## Environment Strategy

- Supabase는 단일 프로젝트로 운영한다.
- `main/develop` 분리는 Git/Vercel에서 처리한다.
- DB 변경은 항상 `db:push:dry` 선검증 후 반영한다.

## 선행 조건

1. `.env.local` 설정
2. `SUPABASE_DB_URL` 환경변수 설정 (`.env.local`에 넣어도 됨)

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

## 마이그레이션 운영 규칙

- 신규 스키마 변경 시 `supabase/migrations`에 SQL 파일 추가
- `supabase/schema.sql`은 스냅샷/참조 용도로 유지
- 배포 전 `db:push:dry`를 반드시 확인

## Troubleshooting

### `no route to host` (db.<project-ref>.supabase.co:5432)

- 원인: 현재 네트워크에서 Direct DB host(IPv6) 라우팅이 막힌 경우가 많다.
- 해결: Supabase Dashboard에서 `Connection string`의 **Session pooler(IPv4)** URI를 복사해 `SUPABASE_DB_URL`에 설정한다.
- 예시 형식:

```bash
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

- 변경 후 다시 실행:

```bash
npm run db:push:dry
npm run db:push
```

## Temporary Policy (Manual DB Migration)

- 적용 기간: `db:push`가 IPv4/네트워크 이슈로 안정화되기 전까지
- 원칙: DB 변경은 Supabase `SQL Editor`에서 수동 실행한다.

실행 순서:

1. `supabase/migrations/*.sql`에서 대상 파일 선택
2. SQL Editor에 전체 붙여넣기 후 실행
3. 검증 쿼리 실행(함수/테이블/정책 생성 확인)
4. 앱 기능 재테스트
5. `docs/04-dev-log.md`에 실행 일시와 적용 파일 기록
