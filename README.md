# Tournament Record

아마추어 테니스 모임/클럽의 경기 기록을 쉽고 신뢰 가능하게 남기는 서비스.

## Why

- 경기 수는 많지만 기록이 엑셀, 카톡, 기억에 흩어져 있음
- 기록 부재로 운영(집계/공지/히스토리/분쟁 대응) 비용이 큼
- 표준화된 데이터가 없어 이후 매칭/레이팅으로 확장하기 어려움

## Product Hypothesis

1. 기록 루프를 단순화하면(입력 -> 확인 -> 확정) 기록률이 올라간다.
2. 클럽 단위 운영 도구가 있으면 소수 인원에서도 도입된다.
3. 기록 데이터가 쌓이면 운영 자동화와 매칭 품질이 개선된다.

## MVP Scope (Phase 1: Record)

- 모임/클럽 생성 및 초대 코드
- 경기 생성(단식/복식), 점수 입력
- 경기 히스토리(개인/클럽)
- 간단 리더보드(승/패, 경기 수)
- 결과 수정 이력(누가, 언제, 무엇을 변경했는지)

## Core Metrics

- 경기 후 24시간 내 기록률
- 주간 활성 모임 수
- 사용자당 주간 평균 기록 수
- 기록 수정/분쟁 발생률
- 4주차 잔존 모임 비율

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres/Auth/RLS)
- Vercel

## Code Structure

- `src/app`: App Router 엔트리
- `src/features/clubs`: 클럽 도메인(feature 단위 분리)
  - `components`, `hooks`, `services`, `types`
- `src/components/ui`: 재사용 UI 컴포넌트

## Local Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000` 확인.

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
```

## Database

- 초기 스키마 파일: `supabase/schema.sql`
- Supabase SQL Editor에서 파일 내용을 실행해서 테이블/RLS 정책 적용
- 스키마 업데이트가 생기면 파일 하단의 신규 SQL도 다시 실행
- 마이그레이션 파일: `supabase/migrations/*.sql`

## Auth

- 로그인 방식: Kakao OAuth (익명 로그인 미사용)
- 설정 가이드: `docs/05-automation.md`의 `Kakao Auth Setup` 참고

## Automation

```bash
npm run env:check
npm run db:smoke
npm run db:push:dry
npm run db:push
npm run verify
npm run automation:check
```

`db:push`를 실행하려면 `SUPABASE_DB_URL` 환경변수가 필요합니다.

## Documentation

- `docs/README.md`
- `docs/01-product-canvas.md`
- `docs/02-design-system.md`
- `docs/03-architecture.md`
- `docs/04-dev-log.md`
- `docs/05-automation.md`
- `docs/06-design-handoff.md`
