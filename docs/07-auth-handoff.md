# Auth Handoff (Archive)

> 이 문서는 2026-03-04 시점 인수인계 기록이다.
> 최신 운영 기준은 `docs/03-architecture.md`, `docs/05-automation.md`, `docs/09-keep-rules.md`를 우선 참고한다.

## 당시 완료 항목 (요약)

- 카카오 OAuth 로그인/콜백 연결
- 이메일 로그인/회원가입 경로 유지
- `Auth session missing` 예외 무시 처리
- 카카오 로그아웃 연동
- Auth 모듈 분리(`src/features/auth/services/auth.ts`)

## 현재(최신) 기준과 차이

- 게스트 참가 플로우가 추가됨
  - `/join/[inviteCode]`에서 게스트/카카오/이메일 진입 가능
- 게스트는 경기 저장 불가 정책이 적용됨
- 초대코드 만료/재발급(`invite_expires_at`)이 도입됨
- 클럽 멤버 소프트 삭제(`is_active`, `left_at`)가 도입됨
- 정회원 프로필 온보딩이 추가됨(2026-04-02)
  - `user_profiles` 테이블 + `profile_completed` 플래그
  - `/auth/callback`이 프로필 미완료 시 `/onboarding/profile?next=...`로 분기
  - `requireRegisteredUser`가 `is_anonymous` 게스트와 미완료 프로필을 차단(서비스 계층 가드)
- club_record 도메인 추가에 따라 게스트 초대가 `/club-record/join/[inviteCode]` 경로로 확장됨
- 카카오 로그아웃은 Supabase sign-out 이후 카카오 REST API 키 + `logout_redirect_uri` 호출 분기를 유지함

> 본 문서는 archive다. 인증/온보딩 최신 설계는 `docs/11-auth-onboarding-design.md`를 참고한다.

## 참고 문서

- 아키텍처: `docs/03-architecture.md`
- 자동화/SQL 반영: `docs/05-automation.md`
- 유지 규칙: `docs/09-keep-rules.md`
