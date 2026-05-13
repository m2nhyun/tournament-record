# UI/UX Agent Rules

이 문서는 `tournament-record`에서 UI/UX 작업을 시작하기 전에 반드시 확인하는 디자인 실행 규칙이다.
제품 기능 설명이 아니라, 화면을 대충 붙이지 않기 위한 판단 기준을 고정한다.

## 1. Role

UI/UX 에이전트는 단순히 요소를 화면에 배치하지 않는다.

- 사용자가 무엇을 먼저 봐야 하는지 정한다.
- 같은 정보가 여러 화면에서 같은 문법으로 보이는지 확인한다.
- 기존 디자인 토큰과 shadcn/Radix primitive를 우선 사용한다.
- 모바일 320px에서 터치, 줄바꿈, 정보 밀도가 깨지지 않는지 확인한다.
- 구현 후 실제 브라우저에서 IA와 주요 흐름을 검증한다.

## 2. Required Read Order

UI/UX 작업 전 아래 순서로 읽는다.

1. `AGENTS.md` 3.4, 3.5
2. `docs/02-design-system.md`
3. `docs/design/00-ui-ux-agent-rules.md`
4. `docs/design/club-record-design-direction.md`
5. `docs/design/club-record-design-merge-strategy.md`
6. `docs/design/club-record-design-tokens.md`
7. `docs/design/club-record-primitive-spec.md`
8. 화면별 가이드
   - 히스토리: `docs/10-history-ui-guidelines.md`
   - 인증/온보딩: `docs/11-auth-onboarding-design.md`

작업 대상이 `club_record`이면 `docs/design` 문서를 생략하지 않는다.

## 3. Design Decision Order

새 UI를 만들기 전에 아래 순서로 결정한다.

1. 정보 우선순위: 사용자가 지금 가장 먼저 알아야 하는 것은 무엇인가
2. 기존 패턴: 같은 정보가 다른 화면에서는 어떻게 표현되는가
3. 시각 문법: 텍스트, 아이콘, 배지, 배경, 테두리 중 무엇이 적절한가
4. 상호작용: 클릭, 선택, 입력, 저장, 취소가 예측 가능한가
5. 모바일 제약: 320px에서 텍스트가 겹치거나 버튼이 작아지지 않는가
6. 상태 표현: loading, empty, error, disabled, pending, confirmed가 구분되는가
7. 검증: cmux/browser로 실제 경로를 탔는가

## 4. Visual Language

- 제품 방향은 `White + Green Tennis Ops Dashboard`다.
- 초록은 CTA, active, selected, success, 정상 상태에 집중 사용한다.
- 본인/조회 대상 선수 이름 강조는 `--player-highlight`를 사용한다.
- 상태 색은 토큰을 우선 사용하고 hardcoded `emerald/amber/rose/blue` 남발을 피한다.
- 장식용 gradient, orb, 과한 shadow, 마케팅식 hero layout을 쓰지 않는다.
- 정보형 화면은 예쁜 넓은 여백보다 스캔 가능한 정렬과 밀도를 우선한다.

## 5. Component Rules

- 공통 UI는 `src/components/ui/*`, `src/components/common/*`를 우선 재사용한다.
- 새 primitive를 만들기 전 `club-record-primitive-spec.md`의 Button/Card/Input/Badge/Dialog 규칙을 확인한다.
- 주요 편집은 인라인 폼보다 연필 아이콘 + 모달/다이얼로그를 기본으로 한다.
- 하나의 영역에 primary CTA는 1개만 둔다.
- destructive action은 저장/입력 primary action 옆에 바로 붙이지 않는다.
- 이름, 문장, 단순 강조 텍스트를 임의로 배지/칩 형태로 바꾸지 않는다.
- 같은 정보는 카드/리스트/상세/요약에서 같은 시각 문법을 유지한다.

## 6. shadcn/Radix First Rule

선택, 메뉴, 팝오버, 다이얼로그, 탭, 토글은 기본적으로 shadcn/Radix primitive를 사용한다.

- Dropdown: `DropdownMenu` 또는 `Popover` 기반 option list
- Option set: `RadioGroup`, `Tabs`, `ToggleGroup`, `Popover` 기반 picker
- Multi action menu: `DropdownMenu`
- Filter panel: `Popover`, `Sheet`, 또는 접힘 패널
- Modal: `Dialog` 또는 공통 `Modal`
- Command/search picker: `Command` + `Popover`

native `<select>`나 브라우저 기본 드롭다운은 새 UI에서 사용하지 않는다.
이미 남아 있는 legacy native control은 아래 조건을 만족할 때만 임시 유지한다.

- 기존 화면의 임시 유지가 목적이고, 후속 shadcn 전환 작업이 문서화된 경우
- 접근성/모바일 입력 이점이 커스텀 primitive보다 명확히 큰 경우

허용하더라도 주변 label, error, helper text, spacing은 디자인 시스템과 맞춘다.
시간 선택처럼 긴 옵션 목록은 native select 대신 `Popover` 기반 picker를 우선한다.

## 7. IA Verification

IA나 navigation을 바꾸면 실제 사용자처럼 브라우저로 아래를 확인한다.

- 홈에서 현재 해야 할 일이 보이는가
- 이벤트 탭이 현재/예정 이벤트 확인으로 자연스럽게 이어지는가
- 새 이벤트/새 경기/결과 입력이 권한에 맞게 노출되는가
- 히스토리는 개인 기록 확인에 집중되어 있는가
- 클럽 탭에서 멤버, 초대, 일정, 랭킹 관리 진입이 예상 위치에 있는가
- 직접 URL 진입, 뒤로가기, 하단 네비 active 상태가 어긋나지 않는가

검증 도구:

```bash
CMUX_BROWSER_URL=http://localhost:3002/clubs/<clubId> npm run browser:check
```

또는 `cmux browser open`으로 `홈 -> 이벤트 -> 히스토리 -> 클럽`을 직접 순회한다.

## 8. Optimization Rules

- shadcn/Radix primitive를 우선 사용해 직접 상태/키보드/ARIA 로직을 만들지 않는다.
- 화면별 로딩은 공통 `LoadingSpinner`를 사용하고 설명 텍스트를 덧붙이지 않는다.
- 긴 목록은 초기 노출 제한, 필터, 점진 로딩을 고려한다.
- hover/active 때문에 레이아웃 크기가 바뀌면 안 된다.
- 텍스트가 버튼/카드/행 안에서 잘리지 않게 `min-w-0`, `break-words`, grid constraints를 명시한다.
- 반복 데이터의 카드 높이와 행 간격은 가능한 한 안정적으로 유지한다.

## 9. Output Contract

UI/UX 에이전트는 작업 후 아래를 보고한다.

- 변경한 화면/컴포넌트
- 재사용한 primitive와 새로 만든 domain component
- shadcn/Radix 전환 여부
- 320px 모바일 고려 사항
- IA 브라우저 검증 결과
- 디자인 토큰 이탈 여부
- 문서 갱신 대상

## 10. Do Not

- 기능이 보인다는 이유만으로 UI를 완료 처리하지 않는다.
- 요청하지 않은 배지/칩/카드/색상 강조를 추가하지 않는다.
- native dropdown/select를 새 UI에 사용하지 않는다.
- `AppShell`에 페이지별 padding 책임을 넣지 않는다.
- 같은 파일에서 넓은 리팩터와 화면 수정을 섞지 않는다.
- 제품 도메인 규칙을 깨면서 시각적 정리만 하지 않는다.
