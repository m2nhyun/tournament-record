# Club Record Master

이 폴더는 `club record` 설계를 작업용 컨텍스트 단위로 쪼개 둔 상위 인덱스다.
구현 시에는 이 파일을 먼저 읽고, 필요한 세부 문서만 추가로 연다.

## Read Order

0. [`CLAUDE.md`](../../CLAUDE.md)
1. [Handoff](./07-handoff.md)
2. [Rules](./01-rules.md)
3. [Domain](./02-domain.md)
4. [Schema](./03-schema.md)
5. [Access](./04-access.md)
6. [Implementation](./05-implementation.md)
7. [Checklist](./06-checklist.md)
8. [Review Findings](./08-review-findings.md)

## Usage Rule

- 제품 규칙 확인이 필요하면 `01-rules.md`
- 엔티티/상태/관계 확인이 필요하면 `02-domain.md`
- migration/DB 구조 작업이면 `03-schema.md`
- RLS/RPC/service 작업이면 `04-access.md`
- 실제 코드 파일 배치와 구현 순서가 필요하면 `05-implementation.md`
- 실제 적용 전 검증 순서가 필요하면 `06-checklist.md`
- 다음 작업자 인수인계와 현재 코드 상태 확인이 필요하면 `07-handoff.md`
- 리뷰에서 발견된 미해결 위험과 회귀 확인 기준은 `08-review-findings.md`

## Implementation Order

1. `03-schema.md` 기준으로 migration SQL 작성
2. `04-access.md` 기준으로 helper function / RLS / RPC 작성
3. `05-implementation.md` 기준으로 서비스 계층 구현
4. 자동 편성 로직 상세화
5. UI/UX는 마지막

## Current Open Items

- 2026-05-07 review findings 확인 및 해결 여부 판정(`08-review-findings.md`)
- 이벤트 완료 시점 계산 규칙
- 자동 매칭 세부 알고리즘
- 결과 무효 처리 기능 도입 여부
