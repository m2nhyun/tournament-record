# Design System

## 목표

- 아이폰 소형 화면(최소 320px 폭)에서도 입력/조회가 명확해야 한다.
- 운영 화면은 시각적 강조보다 가독성과 조작 정확도를 우선한다.

## Design Tokens

`src/app/globals.css`의 CSS 변수 사용.

- `--brand`: 강조색
- `--brand-foreground`: 브랜드 배경 위 텍스트 색
- `--background`, `--foreground`: 기본 캔버스/텍스트
- `--surface-1`, `--surface-2`: 카드/배지 배경 계층
- `--border`, `--ring`: 경계/포커스 스타일

## Typography

- 기본 폰트: Pretendard > Noto Sans KR > 시스템 산세리프
- 제목: `font-semibold`, 좁은 화면에서 `text-3xl` 이하 유지
- 본문: 모바일 기본 `text-sm`, 줄간격 `leading-6`

## Spacing & Layout

- 최소 화면 폭: `320px`
- 모바일 기본 패딩: `px-4`
- 카드 내부 패딩: `p-4 ~ p-5`
- 데스크탑 확장 시 `max-w-*`로 읽기 폭 제한

## Components

- Button: `src/components/ui/button.tsx`
  - variant: `default`, `secondary`, `outline`
  - size: `default`, `sm`, `lg`
- 랜딩 하이라이트 카드: 섹션 카드 패턴 재사용 가능

## Responsive Rules

1. 주요 CTA는 모바일에서 `w-full`로 터치 영역 확보
2. 멀티 컬럼은 모바일 1열 -> `sm` 이상에서 확장
3. 제목 줄바꿈은 좁은 폭 기준으로 먼저 설계
4. 조작성 우선: 텍스트 입력 최소 16px 체감 크기 유지

## 접근성 기준

- 포커스 링 유지 (`focus-visible:ring-*`)
- 텍스트/배경 대비 유지
- 버튼/카드 클릭 영역 충분히 확보
