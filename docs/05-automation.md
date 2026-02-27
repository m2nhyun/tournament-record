# Automation Guide

이 문서는 "수동 SQL 실행"을 줄이고, 반복 작업을 명령어로 고정하기 위한 가이드다.

## 자동화 범위

자동화됨:
- 코드 품질 체크(`lint`, `build`)
- Supabase 연결 스모크 체크
- Supabase 마이그레이션 dry-run / apply
- GitHub Actions CI(푸시/PR 시 자동 검증)

수동 필요:
- Supabase Dashboard의 Auth 설정 변경(예: Anonymous Sign-ins)
- Vercel 대시보드 환경변수 값 입력/회전

## Kakao Auth Setup

현재 앱은 익명 로그인이 아닌 카카오 OAuth를 사용한다.

Supabase:
1. `Authentication > Sign In / Providers > Third-Party Auth > Kakao` 활성화
2. Kakao Client ID/Secret 입력
3. Redirect URL 추가

Kakao Developers:
1. 플랫폼: Web 등록 (`http://localhost:3000`, `https://tournament-record-vercel.vercel.app`)
2. Redirect URI에 Supabase callback 등록
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. 동의항목(이메일/프로필) 설정

## 선행 조건

1. `.env.local` 설정
2. `SUPABASE_DB_URL` 환경변수 설정 (`.env.local`에 넣어도 됨)

예시:

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'
```

## 명령어

```bash
npm run env:check      # 앱 필수 env 확인
npm run db:smoke       # Supabase 연결 스모크 체크
npm run db:push:dry    # 원격 DB 반영 예정 마이그레이션 확인
npm run db:push        # 원격 DB 마이그레이션 실제 반영
npm run verify         # lint + build 전체 검증
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
