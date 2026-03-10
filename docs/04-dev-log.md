# Dev Log

## 2026-02-27

### Infra Bootstrap

- Next.js + Tailwind + shadcn 초기화
- GitHub 원격 연결 및 `main/develop` 브랜치 구성
- Supabase 스키마(`supabase/schema.sql`) 및 RLS 정책 작성
- Vercel 프로젝트 `tournament-record-vercel` 링크 및 production 배포 확인

### UI/Foundation

- 모바일 우선 랜딩 레이아웃으로 개편
- 디자인 토큰(`--brand`, `--surface-*`) 추가
- 소형 화면 기준 CTA/카드 가독성 개선

### Docs

- `docs/` 문서 체계 도입
- 제품 캔버스/디자인 시스템/아키텍처/작업 로그 분리

### Feature (Record Flow v1)

- 홈 화면에 `클럽 생성`, `참가 코드 입장`, `내 클럽 목록` UI 구현
- 참가 코드 가입용 RPC `join_club_by_invite` 스키마 추가

### Automation

- Supabase CLI 초기화(`supabase/config.toml`) 및 마이그레이션 파일 생성
- 자동화 스크립트 추가:
  - `env:check`, `db:smoke`, `db:push:dry`, `db:push`, `verify`
- GitHub Actions CI(`.github/workflows/ci.yml`) 추가

### Refactor (Feature-based)

- `/Users/minhyun/Desktop/client`의 홈/레이아웃 패턴을 참고해 모바일 탭형 홈 구조로 재구성
- `src/features/clubs` 단위로 분리:
  - `components`, `hooks`, `services`, `types`
- App Router(`src/app/page.tsx`)는 조립 역할만 수행하도록 경량화

### Auth Update

- 익명 로그인 제거
- 카카오 OAuth 로그인 게이트(`카카오로 시작하기`) 추가
- 이메일/비밀번호 로그인 및 회원가입 추가
- 개발 편의 옵션 `NEXT_PUBLIC_ALLOW_GUEST_MODE` 추가
- 로그인 사용자만 클럽 생성/참가/목록 기능 접근 가능하도록 가드 적용

### Decision Log

- 사용자 타깃 특성을 고려해 이메일 OTP 대신 카카오 로그인 우선 전략 채택
- Supabase는 단일 프로젝트로 운영하고, 브랜치는 Git/Vercel 레벨에서 분리 관리

## 2026-03-04

### UX Polish

- `ClubDashboard`에서 비로그인 상태 전체 중앙 정렬을 제거하고, `busyType === "loading"`일 때만 스피너를 중앙 배치하도록 수정
- 로딩 완료 후 콘텐츠는 상단 기준 레이아웃으로 유지되게 정리

### Match Record Guardrails

- 경기 생성 화면에서 클럽 멤버가 2명 미만일 때 `EmptyState`로 기록 불가 사유와 이동 액션 제공
- 경기 생성 폼 폭을 `max-w-xl`로 제한해 모바일/데스크탑 모두 입력 집중도 개선
- 복식 선택은 멤버 수 조건(`4명 이상`) 기준으로 제어되도록 연동

### Auth Refactor & Kakao Logout

- 인증 함수(`getCurrentUser`, `ensureSessionUser`, `signIn*`, `signOut`, `requireUser`)를 `src/features/auth/services/auth.ts`로 분리
- `clubs.ts`는 클럽 도메인 로직만 유지하고 인증 의존은 `auth` 서비스 import로 정리
- `signOut`에서 카카오 사용자(`app_metadata.provider === "kakao"`)인 경우 Supabase 로그아웃 후 카카오 로그아웃 URL로 리다이렉트 추가
- 환경변수 `NEXT_PUBLIC_KAKAO_REST_API_KEY` 사용

### Auth State Sync

- `useClubDashboard`에 `onAuthStateChange` 구독 추가
- `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED` 이벤트에서 `refreshClubs()`를 호출하도록 반영
- OAuth 콜백 직후 사용자/클럽 목록 상태 반영 지연을 줄이도록 개선

### Match UX Terminology & Input Redesign

- 점수 입력 UI를 체크박스 방식에서 버튼형 단일 선택 방식으로 전환
- `라운드` 표기를 `게임`으로 정리하고, 히스토리/상세에서 팀 이름 기반 표기로 가독성 개선
- 예외 기록(진행/중단) 상태를 히스토리 카드에서 식별 가능하게 노출

## 2026-03-05

### Club Settings (Owner/Nickname)

- 클럽 상세에 `클럽 이름 변경(클럽장 전용)` 폼 추가
- 클럽 상세에 `내 닉네임 변경` 폼 추가
- 클럽 설정 변경용 RPC 연동: `update_club_name`, `update_my_club_nickname`
- 중복 방지/검증을 위한 DB 제약 추가:
  - `clubs` 이름 정규화 unique
  - `club_members`(club_id + 닉네임 정규화) unique
  - 클럽명/닉네임 길이 check(2~24자)

### Club Member Self Settings

- 클럽명 변경 UI는 클럽장(owner)에게만 노출되도록 유지(멤버 비노출)
- 내 닉네임 변경 위치를 클럽 정보 카드에서 멤버 목록의 `내 항목`으로 이동
- `카카오 프로필 공개`, `전적 검색 허용`, `내 경기 히스토리 공개` 개인 설정 추가
- 개인 설정 저장 RPC `update_my_club_member_settings` 도입

### Dialog Refactor (shadcn)

- 클럽명 수정/내 설정 수정을 페이지 인라인 폼에서 다이얼로그 기반 UX로 전환
- `@radix-ui/react-dialog` + 공용 `Modal` 래퍼 도입
- 편집 관련 코드를 분리 컴포넌트로 분리해 화면 컴포넌트 복잡도 축소

### Match History UX Upgrade

- 히스토리에 `카드/리스트` 보기 전환 추가
- 필터 영역을 Chevron 토글(기본 접힘)로 변경
- 필터 항목: `날짜` + `상대 이름` 적용
- 무한 스크롤(초기 16개 + sentinel) 적용
- 리스트 모드를 최소형(`팀A x:y 팀B`)으로 축소
- 리스트 승패 표현을 배지 대신 얕은 배경색(`green-light`/`red-light`)으로 전환
- 승패 계산 기준을 `side1 고정`에서 `현재 로그인 사용자 기준`으로 수정
- 중간 날짜 그룹 헤더 제거(리스트 스캔 집중도 개선)

### Design Tokens

- 결과 강조용 토큰 추가/연결:
  - `--color-green-primary`, `--color-green-light`
  - `--color-red-primary`, `--color-red-light`
- 관련 가이드를 `docs/10-history-ui-guidelines.md`로 문서화

## 2026-03-06

### Invite Flow & Guest Policy

- 원클릭 초대 링크 페이지 추가: `/join/[inviteCode]`
- 초대 링크 진입 후 `카카오/이메일/게스트` 선택 참가 플로우 추가
- 클럽 상세에 `링크 복사`, `카카오톡 공유` 액션 추가
- 초대 코드 만료일(`invite_expires_at`) 도입, 방장(owner) 전용 재발급 RPC 연동

### Permission Hardening

- `club_member_role`에 `guest` 추가
- 게스트는 클럽 참가는 가능하되 경기 생성/수정은 불가하도록 정책 강화
- 경기 생성은 정회원(owner/manager/member)만 허용
- 경기 수정/결과 수정은 `owner/manager/생성자`만 허용

### Auth/Onboarding

- 이메일 로그인/회원가입 경로를 홈 인증 게이트에서 유지
- 게스트 사용자는 홈에서 `클럽 만들기` 탭 비노출

### Club Member Lifecycle

- 방장(owner) 멤버 제외 기능 추가(`remove_club_member`)
- 멤버 제외는 소프트 삭제(`is_active=false`, `left_at`)로 처리
- 과거 경기/히스토리 참조 무결성(FK) 유지

### Layout Standardization

- 주요 화면을 `AppBar + content(px-4)` 패턴으로 통일
- `LoadingSpinner`를 공통 중앙 정렬 + `title/message` 구조로 통일

## 2026-03-10

### Match Save / Confirmation Flow

- 미완료 게임도 저장 가능하도록 경기 저장 검증 완화
- 게임 입력의 미완료 상태 카피를 `진행/중단`에서 `미완료`로 정리
- 경기 등록/수정 시 즉시 확정 대신 `submitted`로 저장하도록 변경
- 상대 팀 확인용 `match_confirmations` 테이블 및 승인/거절 액션 도입
- 상대 확인 완료 시 `confirmed`, 거절 시 `disputed`로 전환
- 리더보드는 `confirmed` 경기만 반영하도록 조정

### Documentation Alignment

- 루트 `AGENTS.md`를 추가해 작업 규칙과 문서 관리 규칙을 중앙화
- `README.md`에 게스트 참가/경기 확인 플로우/확정 경기 기준 리더보드 반영
- `docs/01-product-canvas.md`에 상대 확인 기반 신뢰도 가설과 지표 반영
- `docs/05-automation.md`에 match confirmation 관련 필수 SQL 및 운영 규칙 반영
- `docs/08-ux-tasks.md`에 완료된 경기 확인 플로우와 남은 재제출 UX 과제 정리
- `docs/10-history-ui-guidelines.md`에 `submitted`/`disputed` 중립 표현 규칙 반영

### Club Navigation UX

- 클럽 탭성 화면(`홈`, `새 경기`, `히스토리`, `리더보드`) 상단에서 뒤로가기를 제거
- 클럽 홈 상단 우측에만 `다른 클럽` 버튼을 두고, 다른 탭에는 제거
- 히스토리 상단 우측은 확인 요청 알림 버튼으로 전환
- 경기 상세에서는 승인 대상 사용자에게만 승인/거절 액션이 보이도록 확인 판정 로직을 보강

### Agent Harness Guidance

- `AGENTS.md`에 역할 분리, 병렬 실행, MCP, 실시간 상태 추적, 자동화에 대한 저장소 전용 도입 원칙 추가
- 범용 생산성 조언을 그대로 복사하지 않고 `tournament-record` 기준 우선순위와 운영 규칙으로 재정리
- 로컬 Codex CLI(`0.112.0`) 기준 `multi_agent` feature를 실제 활성화하고, `AGENTS.md`에 활성화/확인/사용 패턴 문서화
