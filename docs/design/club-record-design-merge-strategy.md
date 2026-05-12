# Club Record Design Merge Strategy

## Principle

`club_record` 디자인은 새 스타일을 덮어씌우는 방식으로 만들지 않는다.
기존 제품에서 이미 사용성이 좋은 부분은 유지하고, 부족한 부분만 외부 레퍼런스로 보강한다.

즉, 방향은 `replace`가 아니라 `selective merge`다.

## What We Keep From Current Product

현재 디자인에서 유지 가치가 높은 부분:

### 1. Mobile-first app shell

- `AppShell`
- `BottomNav`
- 상단 `AppBar`
- 모바일 기준 한 손 사용 구조

이건 제품 사용 맥락과 잘 맞는다.
특히 현장 운영과 회원 사용에서 강점이 있다.

### 2. Simple readable forms

- 현재 `Input`, `Textarea`, `Label`은 과장되지 않고 읽기 쉽다
- 운영 입력 도구로서의 기본 사용성은 괜찮다

즉, 전면 교체보다 `focus / radius / state 표현`만 정리하면 된다.

### 3. Card-first information structure

- 카드 단위 정보 구획은 현재 제품에 잘 맞는다
- 클럽, 일정, 경기, 히스토리 모두 카드형 구조와 잘 맞는다

따라서 카드 구조 자체는 유지하고, tone만 정리한다.

### 4. Existing token-based direction

- `--brand`, `--background`, `--border` 같은 토큰 구조는 이미 있다
- 이 축은 살리고, 하드코딩을 줄이는 쪽으로 간다

## What We Improve

### 1. Too many hardcoded colors

- green/amber/rose 계열이 여러 파일에 직접 박혀 있음
- semantic token으로 끌어올려야 함

### 2. Primitive inconsistency

- Button/Card/Badge/StatusBox가 각자 다른 언어를 씀
- rounded, shadow, color intensity 기준이 통일되지 않음

### 3. Weak operational hierarchy

- 운영 화면에서 `현재`, `변경됨`, `확정`, `주의`, `빈 슬롯` 같은 상태 우선순위가 더 강해야 함

### 4. Visual language not yet tennis-specific

- 지금은 generic app 느낌이 강함
- 테니스 운영 도구다운 green usage와 summary hierarchy를 넣어야 함

## What We Borrow From References

### From Airtable

- 데이터 도구 같은 정리감
- 표/리스트/상태 뱃지 구조
- 운영툴다운 밀도

### From Vercel

- 절제된 타이포
- 여백과 정렬의 정밀함
- 과하지 않은 표면 계층

### From Spotify

- 일부 rounded control 감각
- control hierarchy discipline
- 강조 색은 기능적으로만 쓰는 태도

단, 다크 테마/음악 앱 무드는 가져오지 않는다.

## Merge Rules

### Rule 1

기존 사용성이 좋은 패턴은 유지한다.

예:

- 모바일 탐색 구조
- 카드 단위 흐름
- 큰 CTA 우선

### Rule 2

레퍼런스는 moodboard가 아니라 `문제 해결용`으로만 쓴다.

예:

- 상태 전달이 약하면 Airtable 방식 참고
- hierarchy가 애매하면 Vercel 방식 참고
- control 정리가 약하면 Spotify 일부 참고

### Rule 3

새 레퍼런스를 가져와도 현재 정보구조를 먼저 존중한다.

### Rule 4

디자인 변경은 항상 공통 primitive -> club_record domain component -> screen 순서로 반영한다.

## Decision Filter

새 디자인 아이디어가 생기면 아래 기준으로 거른다.

1. 현장 운영에서 더 빠른가?
2. 상태를 더 분명히 보여주는가?
3. 모바일에서 더 누르기 쉬운가?
4. 데스크톱 운영 화면에서도 정리되는가?
5. 현재 앱 구조를 불필요하게 깨지 않는가?

하나라도 크게 어긋나면 보류한다.

## Non-Goals

- 레퍼런스를 그대로 복제하지 않는다
- 현재 앱에서 이미 잘 작동하는 구조를 멋 때문에 버리지 않는다
- `club_record` 때문에 앱 전체가 불필요하게 재디자인되는 상황을 만들지 않는다
