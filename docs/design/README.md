# Design Docs

이 폴더는 `club_record`와 공통 primitive 정리를 위한 디자인 세부 문서 묶음이다.
앱 전체 UI 규칙은 먼저 `docs/02-design-system.md`를 보고, 이 폴더는 `club_record` 전용 방향이나 primitive 변경이 필요할 때 연다.

## Read Order

1. `../02-design-system.md`
2. `00-ui-ux-agent-rules.md`
3. `club-record-design-direction.md`
4. `club-record-design-merge-strategy.md`
5. `club-record-design-tokens.md`
6. `club-record-primitive-spec.md`
7. `club-record-primitive-plan.md`
8. 필요 시 `design-ui-designer.md`, `design-ux-designer.md`

`DESIGN-spotify.md`는 참고 레퍼런스 아카이브다.
현재 제품 방향은 `club-record-design-direction.md`와 `club-record-design-merge-strategy.md`를 우선한다.

## Usage Rule

- UI/UX 에이전트 실행 기준: `00-ui-ux-agent-rules.md`
- 화면 표현, shadcn/Radix 사용, native control 금지/전환 기준: `design-ui-designer.md`
- IA, 사용자 흐름, 실사용 검증: `design-ux-designer.md`
- 색/타이포/반경/상태 표현 판단: `club-record-design-tokens.md`
- 현재 UI와 외부 레퍼런스 혼합 기준: `club-record-design-merge-strategy.md`
- 공통 컴포넌트 variant나 primitive 계약: `club-record-primitive-spec.md`
- 실제 적용 순서와 audit: `club-record-primitive-plan.md`

## Update Rule

디자인 문서가 바뀌면 아래도 함께 확인한다.

- `docs/02-design-system.md`
- `docs/04-dev-log.md`
- UI 구현이 이미 바뀌었다면 관련 `src/components/*` 또는 `src/features/*/components/*`
