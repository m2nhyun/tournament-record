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
- 익명 로그인 기반 세션 자동 확보(`supabase.auth.signInAnonymously`)
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
