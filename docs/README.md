# Tournament Record Docs

이 폴더는 1인 개발 기준으로 설계/구현/운영 결정을 빠르게 추적하기 위한 문서 집합이다.

작업 실행용 운영 규칙은 루트의 `AGENTS.md`를 먼저 본다.
`AGENTS.md`는 작업 절차와 문서 갱신 규칙을 정의하고, 이 `docs/`는 세부 source of truth를 제공한다.

## 문서 목록

### 전체 지도

- `00-map.md`: 작업 유형별 읽기 경로와 문서 묶음
- `01-product-canvas.md`: 문제정의, 가설, MVP 범위, 핵심 지표
- `02-design-system.md`: 토큰, 타이포, 간격, 컴포넌트 규칙
- `03-architecture.md`: 코드 구조, 데이터 흐름, Supabase 경계
- `04-dev-log.md`: 작업 로그와 변경 이유
- `05-automation.md`: 자동화 스크립트/실행 순서/운영 규칙
- `06-design-handoff.md`: 외부(Replit 등) 디자인 전달 가이드
- `07-auth-handoff.md`: 인증 인수인계 아카이브(최신 기준은 03/05/09 참고)
- `08-ux-tasks.md`: UX 개선 실행 현황(Done/Doing/Backlog)과 후속 과제
- `09-keep-rules.md`: 반드시 유지해야 하는 기준(인증/권한/DB/경기 UX/표기 규칙)
- `10-history-ui-guidelines.md`: 경기 히스토리 UI 큰틀 원칙 + 디테일 체크리스트
- `11-auth-onboarding-design.md`: 정회원 프로필 온보딩과 인증 UX 설계

### 기능별 문서

- `club_record.md`: club_record 작업용 상위 진입 문서
- `club-record/README.md`: club_record 분리 문서 인덱스와 작업 순서
- `club-record/08-review-findings.md`: club_record 리뷰에서 발견된 미해결 위험, 확인 파일, 완료 판정 기준

### 디자인 문서

- `design/README.md`: 디자인 문서 묶음과 읽기 순서
- `design/club-record-design-direction.md`: club_record 전용 시각 방향과 레퍼런스 혼합 원칙
- `design/club-record-design-tokens.md`: club_record 전용 토큰/타이포/사용성 기준
- `design/club-record-primitive-plan.md`: 공통 컴포넌트 정리 순서와 primitive audit
- `design/club-record-design-merge-strategy.md`: 현재 UI에서 유지할 것과 외부 레퍼런스로 보강할 것을 구분하는 기준
- `design/club-record-primitive-spec.md`: 공통 primitive별 유지/변경/variant 계약

## 빠른 읽기 경로

- 작업 시작: `AGENTS.md` -> `docs/00-map.md`
- 일반 기능 변경: `docs/09-keep-rules.md` -> `docs/03-architecture.md` -> 대상 기능 문서
- DB/RLS/RPC 변경: `docs/09-keep-rules.md` -> `docs/05-automation.md` -> `docs/03-architecture.md`
- UI/UX 변경: `docs/02-design-system.md` -> 관련 기능 문서 -> 필요 시 `docs/design/README.md`
- 인증/온보딩 변경: `docs/11-auth-onboarding-design.md` -> `docs/03-architecture.md` -> `docs/05-automation.md`
- `club_record` 변경: `docs/club_record.md` -> `docs/club-record/README.md`

## 운영 원칙

1. 코드 구조를 바꾸면 `03-architecture.md`를 먼저 업데이트한다.
2. UI 규칙이 바뀌면 `02-design-system.md`를 갱신한다.
3. 기능 추가/삭제는 `01-product-canvas.md`와 지표를 함께 수정한다.
4. 모든 큰 변경은 `04-dev-log.md`에 날짜와 함께 남긴다.
5. 문서 경로나 읽기 순서가 바뀌면 이 파일과 `00-map.md`를 함께 갱신한다.
