# Dev Log

## 2026-03-19

### Agent Workflow Bootstrap

- `.codex/agents/`에 `impl`, `db-review`, `ux`, `doc-sync`, `qa` 커스텀 서브에이전트 정의를 추가
- 각 에이전트별로 역할, 책임 범위, 선행 컨텍스트, 금지 사항, 출력물 기대치를 TOML 수준에서 고정
- `AGENTS.md`에 기본 에이전트 역할 지도와 호출 순서를 문서화해 작업 분해 기준을 명확히 정리
- `.codex/subagent-prompts.md`에 에이전트별 호출 템플릿과 오케스트레이션 패턴을 추가
- `AGENTS.md`에 기본 시작 프로토콜을 추가해, 사용자가 서브에이전트 지시를 반복하지 않아도 Codex가 자동으로 탐색 → 역할 분해 → 문서/검증 흐름을 따르도록 정리

### Decision Log

- 구현과 검증, 문서, DB 검토를 분리하되 같은 파일을 여러 에이전트가 동시에 수정하지 않는 구조를 기본 원칙으로 둔다
- `impl`를 코드 변경의 기본 실행자로 두고, `db-review`, `doc-sync`, `qa`는 병렬 검토/판정 역할로 고정한다
- 호출 프롬프트는 자유서술보다 템플릿 기반으로 표준화해, 작업 목표/컨텍스트/수정 범위/출력 형식을 빠뜨리지 않는 쪽을 우선한다
- 사용자가 역할 분리 명령을 직접 쓰지 않아도, 저장소 규칙이 허용하는 범위에서는 Codex가 기본 프로토콜에 따라 적절한 서브에이전트 흐름을 먼저 제안하고 실행하는 쪽을 기본값으로 둔다

### Community / Matching Direction

- 다음 제품 확장 카테고리를 `커뮤니티`, `클럽 내 일정 기반 매칭 시스템` 2축으로 고정
- 현재 일정 생성/참가의 최소 루프는 이미 구현된 상태로 보고, 후속 우선순위를 `일정 상세`, `호스트 관리 액션`, `일정 -> 실제 경기 연결`로 재정렬
- 커뮤니티 기능은 별도 도메인을 성급하게 분리하기보다, 우선 일정 엔티티를 중심으로 참가 맥락과 후속 액션을 강화하는 방향으로 정리

### Schedule Detail MVP

- 클럽 홈 upcoming 일정 카드에 `상세 보기` CTA를 추가
- 새 라우트 `/clubs/[clubId]/schedules/[scheduleId]`를 추가해 일정 상세, 참가자 목록, 비용, 메모, 남은 자리, 참가/취소 액션을 한 화면에서 확인할 수 있게 정리
- `linked_match_id`는 상세 응답에 포함해 이후 일정 -> 실제 경기 연결 CTA를 붙일 수 있는 기반을 마련

### Browser QA / Schema Notice Policy

- UI/라우트 변경 후 기본 브라우저 검증을 `cmux browser` 기준으로 수행하도록 작업 규칙을 강화
- `scripts/automation/cmux-browser-check.sh`와 `npm run browser:check`를 추가해 로컬 페이지 접속, title/url 확인, compact snapshot 출력을 자동화
- 스키마 변경 작업이 있으면 종료 시 사용자에게 변경 파일과 수동 반영 필요 여부를 명시적으로 알리는 규칙을 추가

### Schedule Creation UX Refinement

- 일정 생성 화면에서 캘린더 선택 강조를 더 강하게 주고, 시간 선택을 연속 슬롯 기반 범위로 확장
- 코트비, 캔볼 가격, `본인 포함`을 체크 기반으로 전환하고 기본값은 모두 체크 상태로 유지
- `본인 포함`을 끄면 개설자는 운영자로만 남고 참가자에 자동 포함되지 않도록 `create_match_schedule` RPC와 프론트 로직을 함께 수정
- 일정 카드/상세에 `개설자 미포함` 상태를 노출하고, 인당 예상 비용 안내를 더 명확하게 정리

## 2026-03-17

### Match Schedule MVP

- `match_schedules`, `match_schedule_participants` 테이블과 일정 생성/참가/취소용 RPC를 추가
- 일정은 경기 결과 엔티티(`matches`)와 분리하고, 개설자 자동 참가와 정원 마감 계산을 DB에서 보장하도록 설계
- 일정 입력 항목은 `날짜/시간`, `장소`, `코트 비용`, `캔볼 가격`, `모집 인원`, `남복/여복/성별무관`, `메모`를 기준으로 정리

### UI / UX

- `새 경기` 화면에 `경기 기록`과 `일정 잡기` 모드 전환을 추가
- 클럽 홈에 upcoming 일정 카드와 `참가하기/참가 취소` 액션을 추가
- 일정 생성 시 개설자가 자동 포함되며, 남은 자리를 `정원 - 현재 참가자 수`로 바로 안내
- 기본 브라우저 `date/time` 입력 대신 `react-day-picker` 기반 인라인 캘린더와 클릭형 시간 선택 UI로 일정 생성 화면을 다듬음
- 일정 스키마 미적용 시 generic 에러 대신 `마이그레이션 먼저 실행` 안내가 보이도록 에러 매핑을 추가
- 일정 생성은 다중 날짜/시간 저장처럼 해석이 갈리는 입력 대신 `한 번에 하나의 일정 생성` 흐름으로 다시 고정
- 일정 생성 화면에 `내일/이번 토/이번 일` 빠른 날짜 버튼과 생성 전 요약 카드를 추가해 운영진이 바로 검토 후 저장할 수 있게 정리
- 입력 중 에러는 필드 수정 시 바로 지워지게 해, 잘못된 값 수정 후에도 이전 에러가 화면에 남아 사용자를 방해하지 않도록 조정

### Decision Log

- 일정/모집은 기존 경기 기록 상태(`submitted/confirmed/disputed`)와 의미가 다르므로 별도 엔티티로 분리한다
- `남복/여복/성별무관`은 우선 모집 타입으로 저장하고, 실제 성별 검증은 멤버 프로필 확장 이후에 연결한다
- 이후 채팅방과 실제 경기 기록 연결은 일정 ID를 기준으로 확장하는 방향을 기본으로 삼는다
- 현재 일정 생성은 `복수 후보 제안`보다 `운영진이 즉시 확정 가능한 단일 일정 오픈` 문제를 먼저 푸는 쪽이 제품 우선순위에 맞다

## 2026-03-13

### PM / MVP Direction

- 제품 포지셔닝을 `개인 테니스 기록 앱`보다 `클럽 운영용 경기 기록 플랫폼` 관점으로 명시
- 1차 고객을 개인 사용자가 아니라 `클럽 운영진`으로 두고, 도입/정착/재방문 구조를 다시 정리
- 핵심 활성화 루프를 아래 3가지로 고정
  - 정모 기록 루프
  - 클럽 내 경쟁 루프
  - 운영 편의 루프

### Documentation Alignment

- `docs/01-product-canvas.md`에 제품 포지셔닝, 핵심 사용자 유형, 활성화 루프, MVP 원칙/우선순위, 추가 지표를 반영
- `README.md`에 클럽 단위 플랫폼 관점과 MVP 우선순위를 요약
- `docs/08-ux-tasks.md`에 홈 대시보드, 도입 퍼널, 기록 속도, 미확정 후속 처리 중심의 실행 백로그를 추가

### Decision Log

- MVP는 많은 기능보다 `클럽 생성 -> 초대 -> 첫 경기 기록 -> 확인 -> 재방문` 루프를 먼저 검증한다
- 재방문 동기는 입력 기능보다 `내 경기`, `클럽 최근 활동`, `리더보드`, `확인 대기` 조회 경험에서 만든다
- 운영진이 현장에서 빠르게 기록할 수 있는지가 초기 도입 성공의 가장 중요한 기준이다

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

### Match Confirmation UX Follow-up

- `submitted` 상태 카피를 사용자 관점의 `기록됨` 중심으로 정리하고, `disputed`는 `재검토 필요`로 통일
- 경기 상세에 확인 대상 닉네임과 현재 승인/거절 맥락을 함께 노출
- `disputed` 경기에서 수정 후 다시 저장하면 새 확인 요청이 전송된다는 재제출 흐름을 상세/수정 화면에서 명시
- 확인 상태 공용 유틸과 테스트를 추가해 카드/배지/상세 카피가 다시 갈라지지 않게 정리
- 경기 상세는 `matches.status`만 그대로 쓰지 않고 `match_confirmations` 결정값을 기준으로 상태를 한 번 더 보정하도록 수정
- 히스토리 목록도 동일하게 `match_confirmations` 결정값으로 상태를 보정해 카드와 상세의 `미확정/확정` 불일치를 제거
- 히스토리 카드에서는 미확정 경기를 `기록됨/재검토`로 쪼개지 않고 결과 배지 `미확정` 하나로 단순화
- 카드의 `미완료 게임 포함` 보조 뱃지는 제거하고, 상세 맥락은 상태/점수 요약에 집중하도록 정리
- 클럽 상세의 초대 코드 액션은 2열 grid 대신 역할 조건에 자연스럽게 줄어드는 flex로 정리해 비방장 화면의 버튼 정렬 어색함을 제거

### Optimization / UI & UX Sweep

- 클럽 상세의 이름 변경, 내 설정 저장, 초대 코드 재발급, 멤버 제거는 전체 `refresh` 대신 로컬 상태를 우선 갱신하도록 바꿔 모바일 반응성을 개선
- 클럽 상세에 `링크 복사`, `링크 공유`, `재발급(owner)` 흐름을 추가해 초대 경험과 문서 기준을 다시 맞춤
- `/join/[inviteCode]`는 임시 비활성화 카드 대신 실제 `InviteJoinView`를 다시 사용하도록 복구
- 홈 인증 게이트, 초대 참가 화면, 멤버 리스트, 히스토리 상단 토글을 모바일 우선 배치로 정리해 320px에서 버튼 밀집을 줄임
- 홈에서 클럽이 없는 사용자는 게스트/정회원 여부에 따라 `참가` 또는 `만들기`로 더 자연스럽게 유도
- 히스토리 목록은 filter/view 전환 시 불필요한 remount를 제거하고, 상대 검색은 `내 상대` 기준으로 더 정확하게 동작하도록 조정

### Home / Confirmation / History Follow-up

- 홈 기본 탭은 자동으로 `create/join`으로 넘기지 않고 다시 `내 클럽(list)`를 유지하도록 정리
- 상태/확인 플로우는 목록과 상세가 동일한 상태 보정 로직을 사용하도록 유지
- 히스토리 성능은 전체 remount 제거와 상대 검색 정밀화 중심으로 먼저 개선

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
- Codex global MCP에 `playwright`, `context7`, `exa`를 등록하고 저장소 기준 사용 우선순위를 `AGENTS.md`에 반영
- GitHub 공식 MCP를 `GITHUB_TOKEN` bearer auth 방식으로 등록하고, PR/이슈 연동 용도를 `AGENTS.md`에 추가
- 프로젝트 전용 시크릿은 `direnv`(`.envrc` + `.envrc.local`)로 주입하는 방향으로 정리
- `~/.zshrc`의 전역 `GITHUB_TOKEN` export를 제거하고, 이 저장소에서만 `direnv`로 GitHub MCP 인증을 주입하도록 정리
## 2026-03-20

- 일정 생성 화면의 날짜 선택 강조를 캘린더 셀 자체의 원형 선택 상태로 정리하고, `내일/이번 일` 빠른 날짜 버튼과 시간 기본값을 제거했다. 사용자가 직접 날짜와 시간을 명확히 고르는 흐름으로 맞췄다.
- 일정 생성 시간 선택을 `직접 입력`에서 `시작/종료 드롭다운 + 시간칸 미세 조정` 구조로 바꿨다. 모바일에서 한 손으로 조작하기 쉬운 흐름을 우선했다.
- 일정 생성은 2단계 흐름으로 분리했다. 1단계에서 날짜/시간/장소를 먼저 고정하고, 2단계에서 비용/모집/메모를 정리한다. 생성이 끝나면 성공 화면에 머물지 않고 바로 일정 상세로 이동한다.
- 클럽 홈 `다가오는 일정` 섹션에 생성 직후 확인 경로를 안내하는 문구를 추가해 일정이 어디에 생기는지 더 명확하게 드러냈다.
- `AppShell`을 뷰포트 고정 캔버스로 바꾸고, 스크롤은 내부 `main` 영역만 담당하게 조정했다. 하단 바텀 네비게이션은 스크롤에 휩쓸리지 않고 항상 고정된 위치를 유지한다.
- 루트 `html/body`도 뷰포트 높이로 고정하고 overflow를 잠가서, 문서 전체 스크롤이 생기지 않도록 정리했다.
- Supabase 자동화에 `npm run db:schema:sync`를 추가했고, `npm run db:push` 뒤에는 `supabase/schema.sql`을 자동으로 다시 덤프하도록 연결했다. 대시보드 수동 반영 후에도 로컬 스키마를 맞출 수 있게 했다.
