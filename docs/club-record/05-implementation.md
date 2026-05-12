# Club Record Implementation Plan

## Goal

설계 문서를 실제 코드 구현으로 옮길 때, 어느 파일부터 어떤 순서로 만들지 고정한다.

## Recommended Order

1. Supabase migration 적용
2. helper function / RPC 추가
3. 타입 정의
4. 서비스 계층
5. 쿼리 훅
6. 운영진 화면
7. 회원 화면
8. 자동 편성 세부 로직
9. 마지막에 UI/UX 정리

## Suggested Feature Structure

권장 신규 디렉터리:

- `src/features/club-record/types`
- `src/features/club-record/services`
- `src/features/club-record/hooks`
- `src/features/club-record/components`
- `src/features/club-record/utils`

## Suggested Type Files

- `src/features/club-record/types/settings.ts`
- `src/features/club-record/types/member.ts`
- `src/features/club-record/types/guest.ts`
- `src/features/club-record/types/event.ts`
- `src/features/club-record/types/participant.ts`
- `src/features/club-record/types/slot.ts`
- `src/features/club-record/types/match.ts`
- `src/features/club-record/types/history.ts`
- `src/features/club-record/types/workspace.ts`
- `src/features/club-record/types/access.ts`
- `src/features/club-record/types/dashboard.ts`

## Suggested Service Files

- `src/features/club-record/services/settings.ts`
- `src/features/club-record/services/ranking.ts`
- `src/features/club-record/services/guests.ts`
- `src/features/club-record/services/events.ts`
- `src/features/club-record/services/participants.ts`
- `src/features/club-record/services/assignment.ts`
- `src/features/club-record/services/results.ts`
- `src/features/club-record/services/history.ts`
- `src/features/club-record/services/maintenance.ts`
- `src/features/club-record/services/workspace.ts`
- `src/features/club-record/services/access.ts`
- `src/features/club-record/services/dashboard.ts`
- `src/features/club-record/services/errors.ts`

## Suggested Hook Files

- `src/features/club-record/hooks/use-club-record-settings.ts`
- `src/features/club-record/hooks/use-club-ranking.ts`
- `src/features/club-record/hooks/use-club-record-event-list.ts`
- `src/features/club-record/hooks/use-club-record-event-detail.ts`
- `src/features/club-record/hooks/use-club-record-participants.ts`
- `src/features/club-record/hooks/use-club-record-assignment.ts`
- `src/features/club-record/hooks/use-club-record-result-entry.ts`
- `src/features/club-record/hooks/use-club-record-history.ts`
- `src/features/club-record/hooks/use-club-record-event-workspace.ts`
- `src/features/club-record/hooks/use-club-record-access.ts`
- `src/features/club-record/hooks/use-club-record-dashboard.ts`

## Suggested Route Candidates

운영진용:

- `src/app/clubs/[clubId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/page.tsx`
- `src/app/clubs/[clubId]/club-record/events/page.tsx`
- `src/app/clubs/[clubId]/club-record/new/page.tsx`
- `src/app/clubs/[clubId]/club-record/[eventId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/[eventId]/manage/page.tsx`
- `src/app/clubs/[clubId]/club-record/ranking/page.tsx`
- `src/app/clubs/[clubId]/club/page.tsx`

현재 실제로 연결된 최소 제품 진입:

- `src/app/clubs/[clubId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/page.tsx`
- `src/app/clubs/[clubId]/club-record/events/page.tsx`
- `src/app/clubs/[clubId]/club-record/new/page.tsx`
- `src/app/clubs/[clubId]/club-record/[eventId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/monthly/page.tsx`
- `src/app/clubs/[clubId]/club-record/ranking/page.tsx`
- `src/app/clubs/[clubId]/club-record/history/page.tsx`
- `src/app/clubs/[clubId]/club/page.tsx`

회원용:

- `src/app/clubs/[clubId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/page.tsx`
- `src/app/clubs/[clubId]/club-record/events/page.tsx`
- `src/app/clubs/[clubId]/club-record/[eventId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/monthly/page.tsx`
- `src/app/clubs/[clubId]/club-record/history/page.tsx`
- `src/app/clubs/[clubId]/club/page.tsx`

게스트/초대용:

- `src/app/club-record/join/[inviteCode]/page.tsx`

## Phase Breakdown

### Phase 1

- migration SQL 확정
- RLS / helper function 적용
- type / service 스캐폴딩

### Phase 2

- 운영진 이벤트 생성/수정
- 참석자/게스트 관리
- 그룹/랭킹 조회

### Phase 3

- 슬롯 생성
- 수동 경기 생성
- 결과 입력

### Phase 4

- 자동 편성 로직 상세 구현
- 월간 카드
- 본인 히스토리

### Phase 5

- UI/UX polish
- 데스크톱/모바일 반응형 정리

## Current Product UI Scope

최종 디자인 작업 전에도 아래 최소 화면은 먼저 유지한다.

- club record dashboard home
- event list view
- event workspace
- ranking view
- member self-history view
- monthly public card detail view
- event creation view
- event edit dialog
- participant / guest invite management
- guest invite join view
- manual match creation and result entry controls
- club info / invite / schedule / member management view
- club record dashboard alias at `/clubs/[clubId]/club-record`
- safe event list landing at `/clubs/[clubId]/club-record/events`
- club member ranking management entry from `/clubs/[clubId]/club` member section

이 단계의 목적은 디자인 완성이 아니라 `제품 흐름을 실제 라우트에서 검증 가능하게 만드는 것`이다.

## Keep In Mind

- 자동 편성은 나중에 다시 상세 설계한다
- 운영진용 데이터와 회원 공개 데이터를 섞지 않는다
- 참가자 목록/히스토리는 RPC 응답 DTO 기준으로 설계한다
- direct table query보다 서비스 함수 중심으로 접근한다
- 운영 화면은 이벤트/참가자/편성보드를 느슨하게 조립하지 않고 workspace DTO를 우선 사용한다
- 24시간 경과 경기 취소는 maintenance service/RPC 경계로 분리해 배치나 관리자 액션에서 재사용한다
- 역할 분기는 page/component에서 `owner/manager/member/guest` 문자열 비교를 반복하지 않고 access context/capability를 우선 사용한다
- 클럽 진입 첫 화면은 access/event list/monthly card를 dashboard DTO로 먼저 조립하고, 화면에서는 재가공을 최소화한다
- 민감 서비스는 RLS만 믿지 않고 service 진입에서도 capability를 먼저 검사해 의미 있는 에러를 반환한다
- `/clubs/[clubId]`는 club_record 메인 홈이고, 클럽 정보/초대/일정/멤버 관리는 `/clubs/[clubId]/club`로 분리한다
- 랭킹 화면 명칭은 `클럽 회원 랭킹`으로 통일하고, 홈의 보조 진입과 클럽 탭 멤버 섹션의 `랭킹 관리` 진입을 함께 유지한다
- 랭킹 초기 등록은 `syncClubRecordMembers` -> `sync_club_record_members` RPC를 사용해 활성 클럽 회원을 append한다
- 모바일 스크롤 충돌과 저장 충돌을 줄이기 위해 현재 랭킹 정렬 UX는 drag and drop이 아니라 위/아래 버튼의 즉시 저장 방식으로 둔다
