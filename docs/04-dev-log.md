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
