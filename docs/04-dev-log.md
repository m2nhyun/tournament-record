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
