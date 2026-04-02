# Architecture

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres/Auth/RLS)
- Vercel (main -> production)

## Directory Overview

- `src/app`: 라우트 엔트리
  - `/`: 홈(클럽 대시보드)
  - `/auth/callback`: OAuth 콜백
  - `/onboarding/profile`: 정회원 기본 프로필 온보딩
  - `/join/[inviteCode]`: 원클릭 초대 링크 참가
  - `/clubs/[clubId]/*`: 클럽 상세/히스토리/리더보드/경기
  - `/clubs/[clubId]/schedules/[scheduleId]`: 일정 상세/참가 현황
- `src/features/*`: 기능 단위 모듈 (components/hooks/services/types)
  - `auth`: 세션/로그인/로그아웃 책임
  - `clubs`: 클럽/멤버/초대 흐름
  - `matches`: 경기 생성/상세/히스토리
  - `schedules`: 일정 생성/모집/참가
  - `leaderboard`: 전적 집계
- `src/components/layout`: `AppShell`, `AppBar`, `BottomNav`
- `src/components/feedback`: 로딩/상태/빈 상태 컴포넌트
- `src/components/ui`: 공용 UI 컴포넌트
- `src/lib/supabase/client.ts`: 브라우저 Supabase client
- `supabase/migrations/*`: SQL 마이그레이션(운영 기준 원본)

## Data Model (Current)

- `clubs`
  - `invite_code` (초대 코드)
  - `invite_expires_at` (초대 만료 시각)
- `club_members`
  - 역할: `owner | manager | member | guest`
  - `is_active`, `left_at` (소프트 삭제/탈퇴 처리)
  - 개인 설정: `open_kakao_profile`, `allow_record_search`, `share_history`
- `user_profiles`
  - 전역 정회원 프로필 저장
  - `display_name`, `gender`, `profile_completed`, `auth_provider`
  - 현재는 온보딩용 기본 저장소이며, 핵심 쓰기 기능의 강제 가드는 후속 연결 단계
- `matches`
  - `created_by` 기준 생성자 보존
- `match_players`
  - 경기-멤버 매핑(히스토리 보존 핵심 FK)
- `match_results`
  - 게임 점수 배열(`set_scores`) + 요약
  - `submitted_by`, `confirmed_by`, `confirmed_at`
- `match_confirmations`
  - 상대 팀 확인 대상/승인 상태(`pending | approved | rejected`)
  - 상대 확인이 있어야 `matches.status = confirmed`
- `match_schedules`
  - 경기 기록과 분리된 일정/모집 엔티티
  - 복식 타입(`men_doubles | women_doubles | open_doubles`), 시작/종료 시각, 장소, 비용, 정원 관리
  - 참가 방식 `join_policy`(`instant | approval_required`)를 가진다
  - 상태는 `open | reviewing | full | cancelled`를 사용한다
- `match_schedule_participants`
  - 일정 참가자 목록
  - 개설자는 기본적으로 자동 참가하지만, `본인 포함`을 끄면 운영자만 유지 가능
- `match_schedule_requests`
  - 승인형 모집(`approval_required`)의 신청 대기 큐
  - 상태: `pending | accepted | rejected | cancelled_by_user`
- `audit_logs`
  - 운영/변경 추적 로그

## Core RPC / Functions

- `join_club_by_invite(code, nickname)`: 정회원 참가
- `join_club_by_invite_as_guest(code, nickname)`: 게스트 참가
- `regenerate_club_invite_code(club_id, days)`: 방장 초대코드 재발급
- `remove_club_member(club_id, member_id)`: 방장 멤버 소프트 삭제
- `update_club_name`, `update_my_club_nickname`, `update_my_club_member_settings`

## Permission Model

- 공통 검증 함수:
  - `is_club_member(club_id)`: `is_active = true` 멤버만 true
  - `is_club_admin(club_id)`: active + `owner/manager`
  - `can_manage_match(club_id, created_by)`: `owner/manager` 또는 생성자
- 경기 권한:
  - 생성: `owner/manager/member`만
  - 수정/결과 수정: `owner/manager/생성자`
  - 결과 확정: 확인 대상 전원의 승인 필요
  - 게스트: 경기 조회/참가만, 생성/수정 불가
- 일정 권한:
  - 일정 생성: `owner/manager/member`만
  - 일정 참가: active 클럽 멤버면 가능(게스트 포함)
  - 승인형 모집은 `match_schedule_requests`를 거쳐 개설자 수락 후 참가자로 전환된다
  - 승인형 모집에 pending 신청이 있으면 일정 상태를 `reviewing`으로 보정한다
  - 생성자는 기본적으로 자동 참가되며, `본인 포함` 옵션을 끄면 참가자에 자동 포함되지 않는다
  - 정원/마감 상태는 DB 함수로 보정

## UI Layout Contract

- 페이지 구조 표준:
  - `<AppBar />`
  - `<div className="px-4">...</div>`
- `AppShell`은 캔버스(`max-w`, bottom nav, 배경)만 담당
- 상단 타이틀/뒤로가기/액션은 각 화면의 `AppBar`에서 결정

## Auth Boundary

- 기본 로그인: Kakao OAuth + Email/Password
- 게스트: Supabase anonymous session 지원
- `requireUser`: 로그인 또는 게스트 세션 요구
- `requireRegisteredUser`: 정회원(비-anonymous) 요구
- `/auth/callback`은 정회원 로그인 뒤 `profile_completed`를 확인하고, 미완료 사용자를 `/onboarding/profile`로 보낸다
- 홈(`/`)도 기존 세션의 정회원이 `profile_completed = false`면 온보딩으로 유도한다
- 클럽 생성, 일정 생성, 경기 기록 저장/수정에는 클라이언트 서비스 레벨의 `profile_completed` 가드가 연결되어 있다
- DB/RPC 수준의 전면 강제는 아직 후속 작업 범위다

## Branch & Deploy

- `main`: production
- `develop`: 통합 개발
- `feature/*`: 기능 작업 후 병합
