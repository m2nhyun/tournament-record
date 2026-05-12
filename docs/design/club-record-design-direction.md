# Club Record Design Direction

## Goal

`club_record`는 감성형 소비 앱이 아니라 `테니스 클럽 운영 도구`다.
디자인은 예뻐야 하지만, 우선순위는 아래다.

- 빠른 스캔
- 정확한 상태 인지
- 운영 액션의 명확한 강조
- 모바일/데스크톱 동시 대응
- 시간표/참가자/랭킹/결과 같은 구조화 데이터 처리

## Product Context

- 종목은 `테니스`
- 운영 주체는 `관리자 / 운영진 / 회원 / 게스트`
- 핵심 화면은 `오늘 데일리 매치`, `편성 보드`, `랭킹`, `히스토리`
- 사용 상황은 현장 운영, 빠른 확인, 즉시 수정, 결과 기록

즉, 디자인은 스포츠 브랜드 감성과 운영 대시보드의 실용성을 같이 가져가야 한다.

## Final Direction

최종 방향은 `White + Green Tennis Ops Dashboard`로 잡는다.

- 기본 베이스는 `흰색`
- 핵심 포인트 컬러는 `초록색`
- 테니스 코트/볼/클럽 운영의 인상을 주되 과한 장식은 피한다
- Spotify의 다크/몰입형 철학은 부분 참고만 하고, 전체 테마 기준으로 쓰지 않는다

## Why This Direction

현재 제품과 가장 잘 맞는 이유는 명확하다.

- 운영 데이터가 많아서 밝은 바탕이 가독성에 유리하다
- 초록색은 테니스 코트/볼/스포츠 맥락과 자연스럽게 연결된다
- 클럽 운영 도구는 감성보다 판독성이 우선이다
- 데스크톱 운영 화면에서도 표/보드/카드 구성이 덜 답답하다

## Reference Blend

참고 우선순위는 아래처럼 섞는다.

### Primary

- `Airtable`
  - 데이터 조작감
  - 운영툴다운 정보 구조
  - 리스트/테이블/상태 관리 감각

- `Vercel`
  - 절제된 계층
  - 타이포 정리
  - 과장 없는 정밀한 레이아웃

### Secondary

- `Spotify`
  - 일부 rounded control
  - 레이어 대비 감각
  - compact control discipline

단, 전체 다크 테마/음악 앱 감성은 가져오지 않는다.

### Reject

- 과한 네온 다크
- 게임 UI 같은 과장된 미래감
- 마케팅 사이트식 넓은 여백 중심 레이아웃
- 초록색 남용

## Color Direction

기본 축은 `white + green`이다.

### Base

- Canvas: white / near-white
- Surface: very light neutral
- Text: deep charcoal
- Border: soft neutral gray

### Green Usage

초록은 기능적으로만 쓴다.

- primary CTA
- active state
- selected state
- success state
- 강조 metric
- 코트/참가 가능/정상 상태 표시

초록을 배경 전체나 장식용 그라데이션으로 넓게 쓰지 않는다.

### Semantic

- success: green family
- warning: amber family
- destructive: red family
- info: neutral/blue-green restrained tone

## Visual Keywords

- clean
- sporty
- operational
- structured
- fast
- tactile
- precise

## Component Principles

### Buttons

- 기본 버튼은 라운드가 있는 `soft pill` 또는 `rounded-xl`
- primary는 green fill
- secondary/outline는 white base + border
- 버튼 텍스트는 지나친 uppercase 시스템을 쓰지 않는다
- 현장 운영용이므로 빠르게 읽히는 한국어 라벨 우선

### Cards

- 밝은 surface
- 얕은 그림자
- border로 계층 구분
- 정보 카드와 조작 카드는 밀도 차이를 둔다

### Inputs

- 밝은 배경
- 명확한 border
- focus ring은 green 계열
- 검색/코드 입력은 나중에 pill input 일부 허용

### Badges

- 크기 작게
- 상태 전달 우선
- 색상은 semantic에만 사용

### Navigation

- 현재 앱의 mobile bottom nav 구조는 유지
- `club_record`는 기존 앱 정보구조를 존중한다
- 새로운 visual language를 넣더라도 navigation structure는 크게 바꾸지 않는다

## Layout Principles

### Mobile

- 한 손 조작
- 큰 CTA
- 카드형 진행
- 시간표/슬롯/참가자 정보는 세로 우선

### Desktop

- 운영진 기준
- 좌측 정보, 우측 조작 또는 상단 요약 + 하단 보드 구조
- 표/보드/랭킹/히스토리의 가독성이 우선

## Club Record Specific Patterns

### Dashboard

- 오늘 경기 우선
- `현재 이벤트`, `곧 시작`, `월간 카드`가 첫 시선 안에 들어와야 한다

### Assignment Board

- 시간대 / 코트 / 슬롯 상태가 한눈에 보여야 한다
- 빈 슬롯, 재편성 필요, 미배정 인원은 강하게 드러나야 한다

### Ranking

- 운영진 전용 화면답게 조작성과 정렬감이 중요하다
- 장식보다 줄 간격, 행 높이, 이동 affordance가 중요하다

### History

- 개인 히스토리는 간결하게
- 운영진 히스토리는 필터와 비교가 쉬워야 한다

## What To Keep From Current UI

- 모바일 우선 정보 구조
- AppShell + bottom nav 구조
- 현재 서비스가 이미 쓰는 토큰 기반 접근

## What To Change Gradually

- 하드코딩된 green/amber/rose 색 사용 축소
- 공용 Button/Card/Input/Badge/StatusBox 토큰화 강화
- `club_record`부터 먼저 새 디자인 언어 적용
- 이후 필요하면 `matches / schedules / clubs`로 확장

## Rollout Strategy

1. `club_record` 전용 디자인 방향 먼저 확정
2. 글로벌 토큰은 최소 수정
3. 공용 UI primitive 정리
4. `club_record` 화면에 우선 적용
5. 나머지 화면은 점진 이행

## Non-Goals

- 앱 전체를 즉시 Spotify풍 다크 테마로 바꾸지 않는다
- 정보구조를 디자인 때문에 먼저 뒤집지 않는다
- 테니스 맥락과 무관한 화려한 브랜드 효과를 넣지 않는다
