# Auth / Onboarding Design

이 문서는 이메일/카카오 병행 인증 구조와 가입 직후 프로필 온보딩 설계를 정리한다.
현재 구현 상태를 덮어쓰는 문서가 아니라, 다음 단계 구현의 기준을 고정하는 설계 문서다.

## 1. Problem

현재 저장소에는 아래가 이미 있다.

- 카카오 OAuth 로그인
- 이메일/비밀번호 로그인
- 이메일/비밀번호 회원가입
- 게스트 참가

하지만 아래는 아직 제품 기준으로 완성되지 않았다.

- 정회원 프로필 완료 상태 관리
- 성별 수집
- 이메일 인증 완료 후 후속 UX
- 이메일 가입자와 카카오 가입자의 첫 진입 경험 통합
- 프로필 미완료 사용자의 기능 제한 정책

즉 지금은 “Auth 계정 생성 가능” 수준이고, 목표는 “정회원으로 바로 사용할 수 있는 상태까지 일관된 온보딩 제공”이다.

## 2. Target Outcome

최종 사용자 상태를 아래 4단계로 구분한다.

1. 비로그인
- 홈 접근 가능
- 클럽 생성, 일정 생성, 경기 저장 불가

2. 게스트
- 초대 링크 참가 가능
- 조회/참가만 가능
- 클럽 생성, 일정 생성, 경기 저장 불가

3. 로그인 + 프로필 미완료
- 온보딩 화면으로 유도
- 핵심 쓰기 기능 제한
- 로그아웃 가능

4. 로그인 + 프로필 완료
- 정회원 기능 전부 허용

## 3. Auth Strategy

기본 축은 아래 2개를 병행 유지한다.

- `Email/Password`
- `Kakao OAuth`

원칙:

- 이메일 회원가입은 대중적인 백업/기본 경로로 유지한다.
- 카카오는 한국 사용자군의 빠른 진입 경로로 유지한다.
- 두 경로 모두 같은 `프로필 온보딩`으로 합류한다.

추가 후보:

- `Google OAuth`
  - 카카오 비선호 사용자, 안드로이드/데스크톱 사용자 대응에 유리
- `Apple`
  - iOS 비중이 커진 뒤 검토

## 4. Data Model

현재 `club_members`는 클럽 단위 역할/닉네임/개인 설정을 담고 있다.
온보딩과 전역 프로필은 클럽 멤버 정보와 분리하는 편이 맞다.

### 4.1 New Table

새 테이블 제안:

- `public.user_profiles`

컬럼 초안:

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null unique references auth.users(id) on delete cascade,
display_name text null,
gender text null,
profile_completed boolean not null default false,
auth_provider text null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

### 4.2 Gender

초기 enum 수준은 아래로 충분하다.

- `male`
- `female`
- `unspecified`

원칙:

- 모집 타입(`남복/여복/성별무관`)과 프로필 성별 검증은 분리한다.
- 지금 단계에서는 “프로필 성별 저장”까지를 목표로 한다.
- 실제 성별 기반 모집 검증은 후속 단계에서 붙인다.

### 4.3 Profile Completion Rule

`profile_completed = true` 조건:

- `display_name` 존재
- `gender` 존재

추후 선택값:

- 카카오 프로필 공개
- 전적 검색 허용
- 히스토리 공개

위 선택값은 현재처럼 `club_members`의 클럽 단위 설정으로 유지한다.

## 5. RLS / Permission Design

### 5.1 user_profiles

- 사용자 본인만 read/update 가능
- insert는 authenticated 본인만 가능

필수 정책:

- `select own profile`
- `insert own profile`
- `update own profile`

### 5.2 App-Level Permission

프론트 가드:

- 로그인 필요
- 정회원 필요
- 프로필 완료 필요

DB/RPC 가드:

- 클럽 생성
- 일정 생성
- 경기 저장
- 경기 수정

위 기능은 `profile_completed = true`를 함께 확인해야 한다.

원칙:

- 프론트에서만 막지 않는다.
- 핵심 쓰기 기능은 서비스 계층과 DB 양쪽에서 같이 막는다.

## 6. Route Design

### 6.1 New / Updated Routes

- `/auth/callback`
  - OAuth / 이메일 인증 완료 후 세션 복구
  - 프로필 완료 여부 확인
  - 완료되지 않았으면 온보딩으로 이동

- `/auth/check-email`
  - 이메일 회원가입 직후 인증 안내
  - 재전송
  - “인증 완료 후 계속” CTA

- `/auth/reset-password`
  - 비밀번호 재설정

- `/onboarding/profile`
  - 닉네임
  - 성별
  - 저장 후 원래 목적지로 이동

### 6.2 Redirect Rule

권장 쿼리 파라미터:

- `next`

예시:

- `/onboarding/profile?next=/clubs/<clubId>`

흐름:

1. 사용자가 원래 가려던 화면 기억
2. 프로필 미완료면 온보딩으로 이동
3. 저장 후 `next`로 복귀

## 7. UX Flow

### 7.1 Email Sign Up

1. 이메일 + 비밀번호 입력
2. 회원가입
3. `/auth/check-email` 이동
4. 사용자가 인증 메일 확인
5. 인증 완료 후 로그인
6. 프로필 미완료면 `/onboarding/profile`
7. 저장 후 홈 또는 원래 화면 이동

### 7.2 Kakao Sign In

1. 카카오 로그인
2. `/auth/callback`
3. `user_profiles` 조회
4. 미완료면 `/onboarding/profile`
5. 완료면 홈 또는 원래 화면 이동

### 7.3 Invite Link

초대 링크에서의 우선순위:

- 게스트로 빠르게 입장 가능
- 카카오/이메일 정회원 입장도 가능
- 정회원인데 프로필 미완료면 클럽 참가 전 온보딩 완료 필요

권장 규칙:

- 게스트는 현재처럼 즉시 참가 가능
- 정회원 경로는 프로필 완료 후 참가 확정

## 8. Required UI Changes

### 8.1 Home Auth Gate

현재:

- 이메일 로그인
- 이메일 회원가입
- 카카오 시작

추가:

- 이메일 가입 후 `check-email` 안내
- 비밀번호 재설정 CTA
- 프로필 미완료 사용자 안내

### 8.2 Invite Join View

현재:

- 게스트 / 카카오 / 이메일

추가:

- 정회원인데 프로필 미완료면 참가 완료 대신 온보딩 우선
- 인증 메일 미확인 상태 안내

### 8.3 Onboarding Profile Form

필수 입력:

- 활동 이름
- 성별

초기 카피 원칙:

- “클럽별 닉네임은 나중에 따로 정할 수 있음”
- “성별은 모집 필터와 연결될 수 있지만 지금은 기본 프로필 설정 단계”

## 9. Service Layer Changes

새 서비스:

- `src/features/auth/services/profile.ts`

후보 함수:

- `getMyProfile()`
- `upsertMyProfile()`
- `isProfileComplete()`
- `requireCompletedProfile()`

현재 `auth.ts`는 유지:

- 세션
- 로그인
- 로그아웃
- Auth provider 처리

프로필 완료 여부는 `auth.ts`에 섞지 않고 별도 서비스로 둔다.

## 10. Implementation Order

### Phase 1

- `user_profiles` 테이블 추가
- RLS 추가
- profile service 추가
- `/onboarding/profile` 구현
- `/auth/callback` 분기 추가

### Phase 2

- 이메일 가입 후 `check-email` 화면 추가
- 이메일 인증 후 복귀 UX 정리
- 홈/초대 링크에서 프로필 미완료 가드 연결

### Phase 3

- 클럽 생성 / 일정 생성 / 경기 저장에 `profile_completed` 가드 추가
- DB/RPC도 동일 조건 적용

### Phase 4

- 비밀번호 재설정
- resend email
- provider linking 검토

## 11. Open Questions

### 11.1 display_name vs club nickname

정리:

- `display_name`: 전역 프로필 이름
- `club_members.nickname`: 클럽별 활동 닉네임

권장:

- 온보딩에서 `display_name` 입력
- 클럽 생성/참가 시 기본값으로 복사 제안
- 실제 저장은 클럽 단위 닉네임이 별도로 유지

### 11.2 profile 미완료 상태에서 허용할 범위

권장:

- 읽기 가능
- 쓰기 기능 제한
- 초대 링크로 클럽 join까지 막을지 여부는 구현 단계에서 다시 결정

현재 제안:

- 정회원 join도 온보딩 완료 후 허용

## 12. Non-Negotiables

- 이메일 로그인/회원가입 경로는 계속 유지
- 카카오 로그인 scope는 기존 유지
- 게스트 권한은 넓히지 않음
- 온보딩 미완료 사용자를 “정회원 완료 상태”로 취급하지 않음
- 프론트와 DB 권한 조건을 일치시킴
