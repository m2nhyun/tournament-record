# Club Record Design Tokens

## Goal

`club_record`의 첫 UI 구현 전에, 색/타이포/반경/그림자/상태 표현을 먼저 고정한다.
이 문서는 예쁜 화면을 위한 문서가 아니라 `운영툴의 일관성과 사용성`을 위한 기준이다.

> 2026-05-27 검증 메모: 본 문서가 선언한 토큰 중 일부는 아직 `src/app/globals.css`에 정의되지 않았다.
> - 누락: `--surface-3`, `--brand-soft`, `--brand-border`, `--success`, `--warning`, `--info`
> - 의미 차이: `--muted`/`--ring`은 현재 blue-neutral 계열로 정의되어 있어 "green neutral / green ring" 의도가 반영되지 않음
> - radius 체계 불일치: 본 문서는 `xs/sm/md/lg/pill` 명칭을, globals.css는 `--radius-sm/md/lg/xl/2xl/3xl/4xl` 명칭을 사용
> 후속 작업으로 globals 토큰을 본 문서 기준으로 확장하거나, 본 문서를 현재 globals 기준으로 좁히는 결정이 필요하다. 결정 전까지 `src/components/ui/badge.tsx`, `feedback/status-box.tsx`는 emerald/amber/rose Tailwind 컬러 하드코딩이 남아 있다.

## Core Principle

- 기본 배경은 `밝게`
- 핵심 포인트는 `초록`
- 정보는 `선명하게`
- 상태는 `즉시 구분 가능하게`
- 조작은 `한 번에 읽히게`

## Base Tokens

### Canvas

- `--background`: 따뜻하지 않은 깨끗한 white
- `--foreground`: 깊은 charcoal
- `--surface-1`: 가장 기본 카드 표면
- `--surface-2`: 보조 카드/구역 표면
- `--surface-3`: 강조된 보드/섹션 표면

의도:

- 종이처럼 희지만 차갑게 뜨지 않게
- 코트/볼의 초록 포인트가 묻히지 않게

### Brand

- `--brand`: 테니스 볼/코트 계열 green
- `--brand-foreground`: brand 위 텍스트 색
- `--brand-soft`: 선택/활성 배경용 옅은 green
- `--brand-border`: 선택 상태 테두리용 green

의도:

- CTA
- 선택됨
- 현재 진행 중
- 정상 상태
- 랭킹/기록 강조

### Neutral

- `--muted`: 연한 gray-green neutral
- `--muted-foreground`: 보조 설명 텍스트
- `--border`: 과하지 않은 light gray
- `--ring`: focus ring green

### Semantic

- `--success`: green family
- `--warning`: amber family
- `--destructive`: red family
- `--info`: restrained blue-green or neutral blue

규칙:

- semantic은 badge/status/alert에만 우선 적용
- 배경 전체를 semantic 색으로 덮지 않는다

## Suggested Palette Direction

정확한 hex를 지금 확정하지는 않지만, 방향은 아래를 따른다.

- Background: white / near-white
- Surface: slightly tinted neutral
- Text: near-black charcoal
- Brand: vivid but not neon green
- Border: soft gray
- Success: brand보다 약간 더 안정적인 green
- Warning: readable amber
- Destructive: muted red, 형광 금지

## Typography

### Font Family

- 기본: `Pretendard`, `Noto Sans KR`, 시스템 산세리프 유지
- 현재 제품과 한국어 가독성 기준상 이 선택을 유지한다

### Weight Strategy

- 700: 주요 제목, 핵심 수치, 활성 상태
- 600: 섹션 제목, 강조 라벨
- 400/500: 본문, 메타 정보

### Size Strategy

- 24px: 섹션 최상위 제목
- 18px: 카드/화면 주요 제목
- 16px: 기본 본문 / 버튼
- 14px: 메타/보조 설명
- 12px: badge / 캡션 / 상태 정보

규칙:

- 운영 데이터는 `14~16px`에서 가장 많이 읽히게 한다
- 10px 남발 금지
- uppercase 시스템은 기본으로 쓰지 않는다

## Radius

운영툴은 너무 각지지도, 너무 둥글지도 않아야 한다.

- xs: 6px
- sm: 8px
- md: 12px
- lg: 16px
- pill: 9999px

적용 기준:

- Button: `12px~pill`
- Card: `16px`
- Input: `12px`
- Badge: `pill`
- Dialog: `16px`

## Shadow

현재보다 약간 더 정리하되 과장하지 않는다.

- level-1: 아주 얕은 card shadow
- level-2: floating panel / sticky area
- level-3: dialog

규칙:

- shadow보다 border와 surface 차이로 계층을 먼저 만든다
- 다크 앱처럼 무거운 shadow를 쓰지 않는다

## Motion

- 빠르고 짧게
- 상태 전환은 120ms~180ms 안쪽
- 레이아웃 애니메이션은 필요한 곳만
- 운영 액션에서 긴 easing 금지

## State Expression

### Priority Order

1. text
2. icon
3. badge
4. border
5. background tint

즉, 상태를 배경색 하나에만 의존하지 않는다.

### Required States

- active
- selected
- pending
- confirmed
- cancelled
- dirty / 변경됨
- disabled
- error

## Usability Rules

### Readability

- 테이블/리스트/보드에서 숫자와 상태를 분리해 보여준다
- secondary text는 흐리되, 안 보일 정도로 약하게 만들지 않는다
- 초록은 강조용이지 본문 텍스트 대체용이 아니다

### Tap Targets

- 모바일 클릭 영역 최소 44px
- Icon-only 버튼도 44px 확보

### Form Clarity

- label은 항상 visible
- placeholder는 힌트일 뿐 label 대체 금지
- 에러는 input 근처에 보여준다

### Dense Screens

- 랭킹/편성보드/히스토리는 compact하게 갈 수 있다
- 단, 행 높이는 너무 낮추지 않는다
- 정보 밀도를 올릴 때는 여백보다 정렬 규칙을 먼저 잡는다

## Non-Goals

- 디자인만으로 스포츠 감성을 과장하지 않는다
- 형광 초록, 네온 그림자, 과한 gradient 금지
- 토큰을 너무 많이 만들어 복잡하게 하지 않는다
