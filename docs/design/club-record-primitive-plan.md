# Club Record Primitive Plan

## Goal

공통 컴포넌트를 바로 뜯어고치기 전에, 무엇을 어떤 순서로 바꿀지 정리한다.
`club_record`는 공통 primitive 위에 올라가므로 여기서 흔들리면 전체 사용성이 흔들린다.

핵심 원칙은 `현재 제품에서 잘 작동하는 부분은 유지하고, 부족한 부분만 외부 레퍼런스로 보강한다`이다.

## Priority

1. `Button`
2. `Input`
3. `Textarea`
4. `Card`
5. `Badge`
6. `StatusBox`
7. `Dialog`
8. `AppBar`
9. `BottomNav`

## Current Audit

### Button

현재:

- `rounded-md`
- variant는 최소 구성
- 텍스트는 neutral

유지할 것:

- 현재 크기 체계의 단순함
- 모바일 터치 영역

문제:

- primary/secondary/outline의 위계는 있지만 운영툴용 state variant가 부족함
- `soft pill` 성격이 약함
- icon-only / segmented / destructive action 확장 계획이 필요

필요 작업:

- radius 조정
- primary green 기준 재정의
- disabled / pressed / destructive 명확화

### Input / Textarea

현재:

- 기본 라이트 input
- 사용성은 무난함

유지할 것:

- 지금의 읽기 쉬운 라이트 필드 구조
- 과장되지 않은 form tone

문제:

- focus ring의 시각적 정체성이 약함
- helper/error text 연동 규칙 문서화 필요

필요 작업:

- brand ring 정리
- invalid state 표준화

### Card

현재:

- 밝은 gradient 배경
- 비교적 decorative

유지할 것:

- 카드 기반 정보 구조
- 화면을 섹션 단위로 끊는 방식

문제:

- 운영툴 카드로는 약간 과장된 느낌
- information card와 action card의 밀도 차이가 아직 없음

필요 작업:

- gradient 축소
- surface hierarchy 명확화

### Badge

현재:

- 의미는 명확함
- semantic 하드코딩이 섞여 있음

유지할 것:

- 작은 상태 전달 단위라는 역할

문제:

- 전역 semantic token으로 통일 필요
- club_record 상태 badge 체계 별도 정의 필요

### StatusBox

현재:

- semantic 전달은 됨

유지할 것:

- 간단하고 빠른 feedback 구조

문제:

- success/error/info 색상 하드코딩
- `dirty`, `warning`, `pending` 케이스 확장 필요

### Dialog

현재:

- 무난한 라이트 dialog

유지할 것:

- 단순한 확인 흐름

문제:

- 운영 액션 확인창 기준으로 CTA hierarchy가 아직 약함
- destructive confirm 패턴 표준화 필요

### AppBar / BottomNav

현재:

- 모바일 사용성은 괜찮음
- 구조도 안정적

유지할 것:

- 현재 정보 구조
- mobile-first navigation

문제:

- 시각 언어는 아직 club_record 전용 방향과 정렬되지 않음
- active 상태 강조 방식 단순

## Club Record Specific Primitive Needs

`club_record`는 일반 CRUD보다 아래 primitive가 추가로 필요하다.

- state badge
- metric chip
- time slot cell
- participant pill
- assignment status row
- ranking row handle
- summary stat card

이것들은 공용 primitive 수정 후 `club-record/components`에 domain component로 만든다.

## Usability Checklist

공통 컴포넌트 변경 시 아래를 반드시 본다.

1. 모바일 44px 터치 영역 유지
2. 텍스트 대비 충분
3. icon-only 버튼에 label/aria 존재
4. destructive action은 secondary action과 충분히 구분
5. disabled 상태가 비활성처럼 보여도 읽을 수는 있어야 함
6. focus ring이 명확히 보일 것
7. dense data screen에서 지나친 padding 금지

## Rollout Order

1. 토큰 문서 확정
2. Button/Input/Card/Badge/StatusBox 기준 정리
3. club_record 전용 domain component 추가
4. club_record 화면에 우선 적용
5. 필요 시 기존 clubs/matches/schedules로 확장
