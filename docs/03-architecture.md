# Architecture

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres/Auth/RLS)
- Vercel (main -> production)

## Directory Overview

- `src/app`: 라우트와 화면
- `src/features/*`: 기능 단위 모듈 (components/hooks/services/types)
- `src/features/clubs/*`: 클럽 생성/참가/목록 도메인
- `src/components/layout`: 앱 셸(상단/하단 네비)
- `src/components/feedback`: 상태 메시지 컴포넌트
- `src/components/ui`: 공용 UI 컴포넌트
- `src/lib`: 유틸/외부 연동
- `src/lib/supabase/client.ts`: 브라우저용 Supabase client
- `src/lib/supabase/server.ts`: 서버/관리자용 Supabase client
- `supabase/schema.sql`: DB 스키마 + RLS 정책
- `docs/*`: 제품/설계/작업 문서

## Data Model (MVP)

- `clubs`: 클럽 기본 정보
- `club_members`: 클럽 멤버십, 역할(owner/manager/member)
- `matches`: 경기 메타
- `match_players`: 경기 참가자
- `match_results`: 점수 요약/세트 정보
- `audit_logs`: 수정/변경 이력

## RPC

- `join_club_by_invite(p_invite_code text, p_nickname text)`: 참가 코드 기반 클럽 가입 처리

## Security Boundary

- 퍼블릭 키(`NEXT_PUBLIC_SUPABASE_ANON_KEY`): 클라이언트 조회/작성
- 시크릿 키(`SUPABASE_SERVICE_ROLE_KEY`): 서버 전용
- 모든 민감 조작은 RLS 정책으로 클럽 멤버 권한 검증

## Branch & Deploy

- `main`: production
- `develop`: 통합 개발
- `feature/*`: 기능 작업 후 PR
