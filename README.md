# Tournament Record

아마추어 테니스 모임/클럽의 경기 기록을 쉽고 신뢰 가능하게 남기는 서비스.

## Getting Started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 된다.

## Env Vars

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Vercel Project Settings > Environment Variables에도 동일하게 등록한다.

## Supabase Setup

1. Supabase에서 새 프로젝트 생성
2. Project Settings > API에서 URL / anon / service_role 키 복사
3. SQL Editor에서 `supabase/schema.sql` 실행

## Deploy (Vercel)

1. Vercel에서 GitHub repo `m2nhyun/tournament-record` import
2. Next.js 프레임워크 자동 감지 확인
3. Environment Variables 등록
4. Deploy
