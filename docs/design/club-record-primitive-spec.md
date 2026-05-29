# Club Record Primitive Spec

## Goal

공통 primitive를 실제로 수정하기 전에, 각 컴포넌트의 최종 의도와 변경 범위를 고정한다.
이 문서는 구현 직전 계약이다.

> 2026-05-27 구현 상태 점검 (스펙 vs 코드):
> - Button: 스펙은 `ghost`/`destructive`/`icon`을 추가하지만 `src/components/ui/button.tsx`는 `default`/`secondary`/`outline` + `default`/`sm`/`lg`만 구현. 여전히 `rounded-md`이고 default variant는 `bg-primary`(navy)로 brand green이 아니다.
> - Badge: 스펙은 7종(default/brand/success/warning/destructive/info/neutral) 요구. 실제는 5종, `info`/`neutral` 없음.
> - StatusBox: 스펙은 4종(success/error/info/warning) 요구. 실제는 3종, `warning` 없음.
> - Card: 스펙은 variants(`default/muted/interactive/highlight`)와 gradient 축소를 요구. 실제는 cva variant가 없고 기존 gradient 유지.
> 위 항목은 본 spec이 선언한 contract이며 코드에 아직 반영되지 않은 상태다. 후속 구현 작업으로 추적한다.

## Shared Rules

- 디자인 변경은 전역 구조를 뒤집지 않는다
- `club_record`에 먼저 적용 가능한 방향으로 간다
- mobile usability를 해치지 않는다
- 초록색은 `행동 / 선택 / 정상 상태`에만 집중 사용한다
- semantic 색은 토큰 기반으로 통일한다

## 1. Button

### Keep

- 현재의 단순한 size 체계
- 44px 안팎 모바일 터치 영역
- icon + label 조합 구조

### Change

- `rounded-md` 중심에서 `rounded-xl` 또는 soft pill 계열로 이동
- primary green을 전역 brand token에 더 밀접하게 연결
- outline / secondary의 계층을 더 명확히 분리

### Required Variants

- `default`
  - primary action
  - green fill

- `secondary`
  - muted surface fill
  - 조작은 가능하지만 primary보다 낮은 우선순위

- `outline`
  - white background + border
  - destructive가 아닌 보조 action

- `ghost`
  - icon-only 또는 bar action
  - 배경 최소화

- `destructive`
  - 삭제/제외/취소 계열
  - red semantic 사용

### Required Sizes

- `sm`
- `default`
- `lg`
- `icon`

### Usage Rules

- 같은 영역에 CTA가 2개면 primary는 1개만
- destructive를 primary green과 나란히 둘 때 hierarchy가 분명해야 함

## 2. Card

### Keep

- 카드 기반 정보 구조
- 섹션 분리 역할

### Change

- 현재의 밝은 gradient를 축소
- surface 단계 차이를 토큰으로 더 분명히 분리
- 정보 카드와 조작 카드의 밀도 차이를 허용

### Required Variants

- `default`
  - 기본 정보 카드

- `muted`
  - 보조 설명, summary block

- `interactive`
  - 클릭 가능한 카드
  - hover / active affordance 포함

- `highlight`
  - 현재 이벤트, 주요 지표 강조
  - green soft background 또는 brand border

### Usage Rules

- 카드마다 그림자를 다르게 주지 않는다
- 강조는 border/background tint 우선, 과한 shadow 금지

## 3. Input

### Keep

- 현재의 읽기 쉬운 라이트 input 구조
- 기본 높이와 간결한 spacing

### Change

- focus ring을 green identity에 맞춤
- invalid state 규칙 명확화
- 코드/검색 input은 pill형 확장 가능하게 구조 고려

### Required States

- default
- focus
- disabled
- invalid

### Usage Rules

- placeholder는 label 대체 금지
- 입력 오류는 가능한 한 input 바로 아래에 배치

## 4. Textarea

### Keep

- 현재 단순한 구조

### Change

- input과 같은 ring / invalid 규칙 공유
- notes / operator memo 용도 고려

## 5. Badge

### Keep

- 작은 상태 전달 도구
- pill geometry

### Change

- hardcoded emerald/amber/rose 제거
- semantic token 사용
- club_record 상태용 variant 추가

### Required Variants

- `default`
- `brand`
- `success`
- `warning`
- `destructive`
- `info`
- `neutral`

### Club Record Specific Badges

추후 domain component에서 아래를 조합한다.

- event status badge
- slot status badge
- assignment dirty badge
- ranking group badge

## 6. StatusBox

### Keep

- 빠르게 읽히는 feedback 구조

### Change

- semantic token화
- type 확장
- 운영툴 상태 전달에 맞는 density 조정

### Required Types

- `success`
- `error`
- `info`
- `warning`

### Usage Rules

- 페이지 최상단 상태
- 폼 제출 상태
- destructive confirmation 이후 결과 안내

## 7. Dialog

### Keep

- 단순한 라이트 confirm 구조

### Change

- action hierarchy 명확화
- destructive confirm 패턴 정리
- header / body / footer spacing 규칙 정리

### Required Pattern

- title
- description 연결. 화면에 보일 설명이 없으면 접근성용 hidden description을 둔다
- body
- footer actions

### Club Record Usage

- 참가자 추가는 현재 목록을 먼저 보여주고, 다이얼로그 안에서 회원/게스트 탭으로 분리한다.
- 결과 스코어는 자유 텍스트 입력보다 팀별 `- / +` 스텝퍼를 우선한다.
- destructive action은 주요 저장/입력 버튼 옆에 노출하지 않고 더보기/보조 경로로 분리한다.

## 8. AppBar

### Keep

- sticky top
- back + title + action의 안정적 구조

### Change

- 상태/현재 위치 전달력을 조금 강화
- icon button tone을 primitive button 체계와 맞춤

### Usage Rules

- action은 1~2개 이내
- 뒤로가기는 detail / one-off flow에만

## 9. BottomNav

### Keep

- 현 구조 유지
- mobile app usage에 잘 맞음

### Change

- active 상태 대비 강화
- icon/label 비중 조정
- club_record가 붙어도 nav 자체 구조는 흔들지 않음

## Token Dependency

실제 수정 전 아래 토큰이 준비돼야 한다.

- brand
- brand-soft
- brand-border
- surface-1
- surface-2
- border
- ring
- success
- warning
- destructive
- info

## Migration Order

1. globals token 확장
2. Button
3. Input / Textarea
4. Card
5. Badge / StatusBox
6. Dialog
7. AppBar / BottomNav
8. club_record domain component

## Done Criteria

- primitive가 semantic token을 직접 참조한다
- 하드코딩된 `emerald/amber/rose` 사용이 줄어든다
- club_record 화면에서 새 primitive만으로 상태 표현이 가능하다
- 사용성 저하 없이 모바일 터치 영역과 가독성이 유지된다
