# Tournament Record Docs

이 폴더는 1인 개발 기준으로 설계/구현/운영 결정을 빠르게 추적하기 위한 문서 집합이다.

## 문서 목록

- `01-product-canvas.md`: 문제정의, 가설, MVP 범위, 핵심 지표
- `02-design-system.md`: 토큰, 타이포, 간격, 컴포넌트 규칙
- `03-architecture.md`: 코드 구조, 데이터 흐름, Supabase 경계
- `04-dev-log.md`: 작업 로그와 변경 이유

## 운영 원칙

1. 코드 구조를 바꾸면 `03-architecture.md`를 먼저 업데이트한다.
2. UI 규칙이 바뀌면 `02-design-system.md`를 갱신한다.
3. 기능 추가/삭제는 `01-product-canvas.md`와 지표를 함께 수정한다.
4. 모든 큰 변경은 `04-dev-log.md`에 날짜와 함께 남긴다.
