# Auth Handoff (2026-03-04)

## 현재까지 완료된 작업

### 1) 로그인 플로우
- 카카오 OAuth 버튼/호출 연결 완료
- 이메일/비밀번호 로그인 및 회원가입 흐름 유지
- `Auth session missing` 예외는 세션 조회 시 무시하고 정상적으로 `null` 사용자 처리

### 2) 카카오 콜백 처리
- `/auth/callback` 페이지 추가 완료
- 파일: `src/app/auth/callback/page.tsx`
- 동작: 해시 토큰 세션 반영 후 `/`로 이동
- `onAuthStateChange` 구독으로 콜백 직후 대시보드 상태 반영 즉시화
  - 파일: `src/features/clubs/hooks/use-club-dashboard.ts`

### 3) 카카오 scope 정리
- 이메일 권한 강제 요청을 피하도록 scope 명시
- 파일: `src/features/clubs/services/clubs.ts`
- 현재 코드: `scopes: "profile_nickname profile_image"`

### 4) 대시보드 로딩 UX
- 전체 콘텐츠 중앙 정렬 제거
- `loading`일 때만 스피너 중앙 배치
- 파일: `src/features/clubs/components/club-dashboard.tsx`

### 5) 경기 생성 가드레일(반영됨)
- 멤버 수 부족 시(2명 미만) 빈 상태 처리
- 복식 가능 여부 제어(4명 이상)
- 파일: `src/features/matches/components/match-creation-form.tsx`

## 현재 상태/확인 결과

### 데이터 식별 기준
- 사용자 식별은 `auth.users.id`(uuid) 기반
- `clubs.created_by`, `club_members.user_id`가 `auth.users(id)` FK로 연결
- RLS도 `auth.uid()` 기준으로 권한 검증

### 카카오 로그아웃 상태
- `supabase.auth.signOut()` 이후, 카카오 사용자면 IdP 로그아웃 URL로 이동하도록 연동 완료
- 파일: `src/features/auth/services/auth.ts`
- env: `NEXT_PUBLIC_KAKAO_REST_API_KEY` 필요

## Supabase/Kakao 설정 체크리스트 (현재 기준)

### Kakao Developers
- 카카오 로그인 활성화: ON
- Redirect URI: `https://nomcsuizsztyhxkehila.supabase.co/auth/v1/callback`
- 동의항목: 닉네임(필수), 이메일(선택 또는 미사용)

### Supabase Auth
- Provider: Kakao 활성화
- Client ID: Kakao REST API Key
- Client Secret: Kakao 콘솔 발급값
- Allow users without an email: ON (현재 MVP 권장)
- URL Configuration:
  - Site URL: `https://tournament-record.vercel.app`
  - Redirect URLs: `https://tournament-record.vercel.app/**`, `http://localhost:3000/**`

## 남은 작업 (다음 세션에서 우선순위)

### 완료됨
1. `auth` 책임 분리 ✅
- `src/features/auth/services/auth.ts` 신설
- `clubs.ts`의 인증 함수(`getCurrentUser`, `signIn*`, `signOut`, `requireUser`) 이동

2. 카카오 완전 로그아웃 연동 ✅
- Supabase signOut 이후, provider가 kakao면
- `https://kauth.kakao.com/oauth/logout?client_id=...&logout_redirect_uri=...`로 이동
- env 추가: `NEXT_PUBLIC_KAKAO_REST_API_KEY`

3. 빌드 검증 ✅
- `npm run lint && npm run build` 통과

4. Auth 상태 변경 구독 ✅
- `onAuthStateChange`로 로그인/로그아웃/토큰갱신 반영 즉시화
- 콜백 후 UX 안정성 개선

5. 문서 정리 ✅
- `docs/03-architecture.md`에 auth 모듈 분리 구조 반영
- `docs/04-dev-log.md`에 auth 분리/카카오 로그아웃/상태구독 작업 로그 추가

### 남은 작업
1. 배포 마무리
- `main` push 후 Vercel 최신 배포 확인

## Full Auto 재시작 후 바로 실행할 작업 명령(예시)

```bash
npm run lint
npm run build
```

```bash
git add .
git commit -m "refactor: split auth service and add kakao full logout"
git push origin main
```
