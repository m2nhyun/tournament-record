# Club Record Handoff

이 문서는 다음 작업자가 `club_record` 작업을 이어받기 위한 현재 상태 요약이다.
상세 설계는 같은 폴더의 세부 문서를 읽고, 이 파일은 작업 진입용으로만 사용한다.

## Required First Reads

작업 시작 전 반드시 아래 순서로 읽는다.

1. `CLAUDE.md`
2. `docs/club_record.md`
3. `docs/club-record/README.md`
4. `docs/club-record/08-review-findings.md`
5. 필요한 범위의 `docs/club-record/01-rules.md` - `06-checklist.md`

`CLAUDE.md`에서 특히 지켜야 할 기준:

- 불명확한 해석은 먼저 드러내고 묻는다.
- 최소 변경으로 해결한다.
- 작업 범위 밖의 리팩터링을 하지 않는다.
- 성공 기준을 정하고 검증까지 끝낸다.
- `any` 타입은 금지한다. `eslint.config.mjs`에 `@typescript-eslint/no-explicit-any: error`가 명시되어 있다.

## Product Direction

- `club_record`는 테니스 클럽 운영용 데일리 매치 시스템이다.
- 현재 클럽 진입 메인은 `/clubs/[clubId]`의 `club_record` 대시보드다.
- 클럽 정보/초대/일정/멤버 관리는 `/clubs/[clubId]/club`로 분리했다.
- 이벤트 진입은 `/clubs/[clubId]/club-record/events`의 안전한 목록 화면을 먼저 거치고, `새 이벤트`는 `canCreateEvent`가 true일 때만 보인다.
- 하단 네비게이션은 `홈 / 이벤트 / 히스토리 / 클럽` IA를 따른다.
- `/clubs/[clubId]/club-record`는 기존 대시보드 별칭으로 유지한다.
- 당장은 제품 기능 완성이 우선이고, 최종 UI/UX 및 디자인 시스템 적용은 후순위다.

## Current Handoff Snapshot

2026-05-08 현재 다음 작업자가 이어받아야 할 상태:

- `src/app/clubs/[clubId]/page.tsx`는 `ClubRecordDashboardView`를 메인 클럽 홈으로 렌더링한다.
- `src/app/clubs/[clubId]/club/page.tsx`는 기존 `ClubDetailView`를 렌더링해 클럽 정보/초대/일정/멤버 관리를 맡는다.
- `ClubDetailView`의 멤버 섹션 우측 `랭킹 관리`는 `/clubs/{clubId}/club-record/ranking`으로 연결된다.
- 랭킹 화면 명칭은 `클럽 회원 랭킹`으로 통일했고, 홈의 보조 진입도 같은 명칭을 사용한다.
- `club_record_members`가 비어 있는 클럽은 운영진/관리자가 랭킹 화면의 동기화 액션으로 활성 클럽 회원을 추가한다.
- `src/app/clubs/[clubId]/club-record/events/page.tsx`는 회원/게스트도 안전하게 들어갈 수 있는 이벤트 목록을 보여주고, `canCreateEvent`가 있을 때만 `새 이벤트`를 노출한다.
- 하단 네비게이션은 `홈 / 이벤트 / 히스토리 / 클럽`으로 바뀌었고, `이벤트`는 `club-record/events`, `히스토리`는 `club-record/history`, `클럽`은 `club`으로 연결된다.
- `이벤트` active 범위는 `club-record/events`, `club-record/new`, 이벤트 상세/워크스페이스 라우트다.
- `홈` active 범위는 `/clubs/{clubId}`, `/clubs/{clubId}/club-record`, `/clubs/{clubId}/club-record/monthly`, `/clubs/{clubId}/club-record/ranking`이다.
- `/clubs/[clubId]/club-record`는 대시보드 alias로 남아 있다.
- 일반 경기 CTA 그리드는 `ClubDetailView`에서 제거되어, 클럽 상세는 클럽 관리 중심으로 정리됐다.
- 실제 DB 적용: 완료. 사용자가 `nomcsuizsztyhxkehila`가 local/prod 공용 메인 DB임을 확인하고 명시 승인해 운영 DB에 적용함
- 적용된 migration: 기존 4개 `club_record` migration + smoke 중 발견된 RPC/fixture 보정 migration 3개 + 클럽 회원 랭킹 동기화 migration
  - `20260506120000_add_club_record_core.sql`
  - `20260506121000_add_club_record_event_tables.sql`
  - `20260506122000_add_club_record_result_tables.sql`
  - `20260506123000_add_club_record_rls_and_functions.sql`
  - `20260507094500_fix_club_record_ranking_move.sql`
  - `20260507095500_fix_club_record_guest_join_conflicts.sql`
  - `20260507100500_fix_club_record_result_update_conflict.sql`
  - `20260508093000_add_club_record_member_sync.sql`
  - `20260508094000_restrict_club_record_member_sync_grant.sql`
  - `20260512113000_fix_club_record_history_guest_names.sql`
  - `20260512120500_add_club_record_history_team_names.sql`
- remote dry-run: 최종 `Remote database is up to date.`
- schema sync: `npm run db:push` 후 `supabase/schema.sql` 동기화 완료
- smoke SQL: Docker의 Postgres `psql` 클라이언트로 `supabase/tests/club_record_smoke.sql` 실행 완료, `ROLLBACK`으로 종료
- smoke 중 보정: fixture 클럽명 길이, temp table role grant, non-participant fixture 분리, archived/cancelled monthly stats exclusion fixture 추가
- 코드 검증: `rg` explicit any scan, `npm run env:check`, `npm run db:smoke`, `npm run lint`, club-record util tests, `npm run build` 통과
- 게스트 초대 진입: `/club-record/join/[inviteCode]` route와 `ClubRecordGuestJoinView`를 추가했고, `verifyGuestInviteCode` / `joinEventAsGuestByInviteCode` 기존 서비스 경로를 재사용한다.
- 게스트 초대 링크: `ClubRecordGuestInvitePanel`이 `/club-record/join/{code}` 링크를 복사하도록 맞췄다.
- 회원 자기 기록: `canViewOwnHistory`가 있는 멤버는 `/clubs/{clubId}/club-record/history`에서 `내 기록`으로 들어가 카드/리스트 보기, 날짜/상대 이름 필터, 이벤트 링크를 볼 수 있다.
- 회원 자기 기록과 운영진 타인 기록 RPC는 정회원 닉네임과 게스트 프로필 표시명을 모두 팀/상대 이름 배열에 포함한다. `team_names`는 본인/대상 회원을 첫 항목으로 포함한 팀 전체이며, UI는 첫 이름을 `--player-highlight` 파란 계열 텍스트 색상/굵기로만 강조한다. 이름을 배지나 chip 형태로 바꾸지 않는다.
- 월간 공개 카드 상세: `/clubs/{clubId}/club-record/monthly` route, `ClubRecordMonthlyCard`, `useClubRecordMonthlyCard`를 추가했고 대시보드 월간 카드 미리보기에서 이 경로로 이동한다. 상세 화면은 read-only이며 기존 `getMonthlyPublicCard` RPC/service를 재사용한다.
- 이벤트 수정 진입: 워크스페이스 요약 카드에서 운영진/관리자가 `ClubRecordEventEditDialog`를 열어 이름/날짜/시간/코트 수를 수정할 수 있다.
- 이벤트 수정 경고: 날짜/시간/코트 수 변경은 참가자와 편성을 초기화하므로 UI에서 체크 확인을 요구한다. 확정 경기가 있으면 기존 서비스 가드가 저장을 차단한다.
- 참가자 추가 UX: 워크스페이스는 현재 참가자 목록을 먼저 보여주고, `참가자 추가` 다이얼로그에서 `클럽 회원 / 게스트` 탭으로 회원 다중 추가와 수동 게스트 추가를 처리한다.
- 결과 입력 UX: 회원/운영진 결과 입력은 슬롯 카드 인라인 폼이 아니라 다이얼로그로 처리한다. 입력 불가 상태는 확정/취소/비참가/권한 없음 안내를 보여주고, 운영진 결과 수정은 별도 `결과 수정` 액션으로 구분한다.
- 스코어 입력 UX: 텍스트 입력 대신 팀별 `- / +` 스텝퍼로 점수를 조정한다. 저장 경계는 내부 `6-4` 형식 문자열과 기존 결과 RPC를 유지한다.
- 자동 편성: 같은 페어 반복과 같은 사람 조합 2회 초과는 점수 페널티로만 처리한다. 참가자가 부족하면 조합 반복보다 뒤 시간대 슬롯 생성을 우선한다.
- 자동 편성 동시성: 같은 시작 시간의 여러 코트에는 한 참가자를 중복 배정하지 않는다. 참가자가 4명인 2코트 이벤트는 같은 30분 구간에 1경기만 만들고 다음 시간대로 넘어간다.
- 이벤트 요약: `편성 가능 슬롯`은 실제 빈 코트 수가 아니라 현재 참가자/동시성 조건으로 4명을 배정할 수 있는 슬롯 수를 뜻한다.
- 이벤트 노출: 홈/이벤트 탭은 종료 시간이 지난 이벤트를 현재/예정 이벤트 fallback으로 보여주지 않는다. 과거 이벤트는 히스토리/상세 직접 진입 범위로 남긴다.
- 지난 이벤트 워크스페이스: 직접 URL 진입 시 `지난 이벤트` 배지를 표시하고, 이벤트 수정/취소/자동 편성/참가자 추가/수동 경기 생성은 숨긴다. 운영진 사후 결과 입력/수정은 허용한다.
- 빈 코트 편성: 가능 인원이 4명 미만이면 수동 경기 생성 폼을 숨기고 사유만 표시한다.
- 클럽 초대코드: 만료된 초대코드는 복사/공유를 비활성화하고 owner에게 재발급 CTA를 우선 노출한다.
- Empty state: 홈/이벤트 탭의 이벤트 없음 상태는 운영진에게 `새 이벤트 만들기` CTA를 직접 제공한다.
- 랭킹 관리: 클럽 회원 랭킹 누락 회원 append 액션은 `클럽 회원 불러오기` 문구로 통일한다.
- 로딩 UI: 공통 로딩 상태는 텍스트 없이 스피너만 표시한다.
- 남은 DB 검증 리스크: 현재 handoff 기준 주요 DB smoke regression은 통과했고, 이후 신규 DB 변경 시 smoke를 다시 확장한다

이번 시점의 핵심 판단:

- `club_record` DB 구조/RLS/RPC/trigger는 메인 DB에 반영됐고 smoke 기준 핵심 권한/보존 경계가 통과했다.
- 다음 작업자는 DB apply를 다시 시도하지 말고, `npm run db:push:dry`가 up to date인지 확인한 뒤 기능/UI 후속 작업을 진행한다.

## Current Domain Rules

핵심 규칙만 요약한다. 변경 전에는 반드시 `01-rules.md`를 확인한다.

- 권한: 관리자(owner) > 운영진(manager) > 회원(member) > 게스트(guest)
- 관리자: 클럽당 1명
- 랭킹: 숫자형, 1위가 최고, 운영진/관리자만 접근
- 클럽 회원 랭킹 동기화: 운영진/관리자만 가능, 활성 `owner/manager/member`만 추가하고 게스트/비활성 멤버는 제외
- 그룹: A/B/C, 기본 비율 20/30/50, 운영진 변경 가능
- 데일리 매치: 날짜, 시작 시간, 종료 시간, 코트 수 기반
- 슬롯: 30분 단위, 전부 복식
- 참가자: 운영진이 추가/삭제, 게스트 초대코드 및 수동 게스트 추가 지원
- 자동 편성: 가능한 참가자 4명이 있으면 조합 반복 선호보다 슬롯 채우기를 우선하고, 동시 시간대 중복 출전만 하드 차단
- 결과: UI는 팀별 스텝퍼 입력, 저장/RPC 경계는 `6-4` 형식 문자열 기준, 승/패/무 자동 계산
- 결과 입력: 참가 회원 중 1명이 24시간 내 입력, 운영진/관리자는 전체 수정 가능
- 게스트: 결과 입력 불가
- match_count: 확정된 경기만 포함, 자동/수동 경기 모두 동일하게 포함

## Implemented Code

### Routes

- `src/app/clubs/[clubId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/page.tsx`
- `src/app/clubs/[clubId]/club-record/events/page.tsx`
- `src/app/clubs/[clubId]/club-record/new/page.tsx`
- `src/app/clubs/[clubId]/club-record/[eventId]/page.tsx`
- `src/app/clubs/[clubId]/club-record/monthly/page.tsx`
- `src/app/clubs/[clubId]/club-record/ranking/page.tsx`
- `src/app/clubs/[clubId]/club-record/history/page.tsx`
- `src/app/clubs/[clubId]/club/page.tsx`
- `src/app/club-record/join/[inviteCode]/page.tsx`

### Feature Folder

- `src/features/club-record/types`
- `src/features/club-record/services`
- `src/features/club-record/hooks`
- `src/features/club-record/components`
- `src/features/club-record/utils`

### Main Components

- `club-record-dashboard.tsx`: club record 홈, 현재 이벤트, 다음 이벤트, 월간 공개 카드
- `club-record-event-list.tsx` / `ClubRecordEventListView`: 안전한 이벤트 목록, current/upcoming events, canCreateEvent 전용 새 이벤트 CTA
- `club-detail.tsx` (`ClubDetailView`): 클럽 정보/초대/일정/멤버 관리
- `club-record-event-form.tsx`: 새 이벤트 생성
- `club-record-event-edit-dialog.tsx`: 이벤트 이름/일정/코트 수 수정, 일정 변경 초기화 경고
- `club-record-event-workspace.tsx`: 이벤트 운영 워크스페이스
- `club-record-participant-manager.tsx`: 회원/게스트 참가자 추가 및 삭제
- `club-record-guest-invite-panel.tsx`: 이벤트별 게스트 초대코드 생성, 재발급, 비활성화
- `club-record-guest-join-view.tsx`: Kakao/email/anonymous session 기반 초대 참가 진입
- `club-record-monthly-card.tsx`: 월간 공개 카드 상세, 이전/다음 달 이동, 새로고침, loading/error/empty 상태
- `club-record-history.tsx`: 회원 본인 기록 카드/리스트, 필터, 상태 처리
- `club-record-match-controls.tsx`: 수동 경기 생성, 경기 삭제, 결과 입력/수정
- `club-record-ranking.tsx`: 클럽 회원 랭킹 조회, 활성 회원 동기화, 위/아래 이동

### Main Hooks

- `use-club-record-monthly-card.ts`: 월간 공개 카드 상세 DTO 조립, 월 이동, 새로고침 상태 관리

### Main Services

- `access.ts`: role/capability context, 현재 사용자의 `clubMemberId` 포함
- `dashboard.ts`: 홈 진입용 DTO 조립
- `workspace.ts`: 이벤트 상세용 DTO 조립
- `events.ts`: 이벤트 생성, 수정, 소프트 삭제
- `participants.ts`: 참가자 조회, 회원/게스트 추가, 삭제 RPC
- `guests.ts`: 게스트 프로필, 수동 게스트, 초대코드, 초대 참가 join 흐름
- `assignment.ts`: 슬롯 overview, 보드, 자동 편성, 수동 경기 RPC
- `results.ts`: 스코어 파싱 후 결과 입력/수정 RPC
- `history.ts`: 본인 히스토리, 운영진 타인 히스토리, 월간 공개 카드
- `maintenance.ts`: 만료 경기 취소 RPC wrapper

### Main Utilities

- `score.ts`: `6-4` 형태 스코어 파싱, 무승부 처리
- `slots.ts`: 이벤트 시작/종료/코트 수 기반 30분 슬롯 생성
- `assignment-pool.ts`: 참가자별 편성 후보 계산
- `assignment-board.ts`: 슬롯별/시간대별 빈 코트, 편성 가능 인원, 미배정 인원 계산
- `auto-assignment.ts`: 자동 편성 v1
- `access.ts`: role -> capability 매핑
- `date.ts`: 월간 카드용 날짜 유틸

## Migration Drafts

메인 DB에 적용 완료된 migration이다.

- `supabase/migrations/20260506120000_add_club_record_core.sql`
- `supabase/migrations/20260506121000_add_club_record_event_tables.sql`
- `supabase/migrations/20260506122000_add_club_record_result_tables.sql`
- `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
- `supabase/migrations/20260507094500_fix_club_record_ranking_move.sql`
- `supabase/migrations/20260507095500_fix_club_record_guest_join_conflicts.sql`
- `supabase/migrations/20260507100500_fix_club_record_result_update_conflict.sql`
- `supabase/migrations/20260508093000_add_club_record_member_sync.sql`
- `supabase/migrations/20260508094000_restrict_club_record_member_sync_grant.sql`
- `supabase/migrations/20260512113000_fix_club_record_history_guest_names.sql`
- `supabase/migrations/20260512120500_add_club_record_history_team_names.sql`

주의:

- `club_record_guest_profiles.guest_user_id`는 nullable이다.
- 카카오 기반 게스트 초대 흐름과 운영진 수동 게스트 추가를 동시에 수용한다.
- 참가자 `arrival_time`은 `timestamptz`이며 UI의 `HH:MM`을 이벤트 날짜 기반 ISO timestamp로 변환해서 저장한다.
- 자동/수동 경기 생성은 RPC에서 같은 시간대 중복 출전과 `arrival_time`보다 이른 슬롯 배정을 차단한다.
- 확정 경기 삭제는 RPC에서 차단한다.
- 확정 경기 삭제는 trigger에서도 차단하며, 이벤트 시간/코트 변경과 이벤트 삭제/취소도 `confirmed` 경기가 있으면 서비스/trigger 경계에서 막는다.
- 경기와 연결된 참가자 direct delete는 trigger에서 차단하고, 참가자 삭제 RPC가 pending/cancelled 경기 정리 후 삭제하는 경계를 유지한다.
- 비활성 멤버는 과거 참가 row가 있어도 이벤트/경기 참가자 helper와 결과 입력 권한을 통과하지 못한다.
- 슬롯 overview RPC는 운영진/관리자 또는 해당 이벤트 참가자에게만 전체 보드를 내려준다. 일반 멤버는 참가하지 않은 이벤트 보드를 볼 수 없다.

## Verification

최근 통과한 검증:

```bash
npm run lint
npm run test -- src/features/club-record/utils/score.test.ts src/features/club-record/utils/slots.test.ts src/features/club-record/utils/assignment-pool.test.ts src/features/club-record/utils/auto-assignment.test.ts src/features/club-record/utils/assignment-board.test.ts src/features/club-record/utils/access.test.ts src/features/club-record/utils/date.test.ts
npm run build
npm run db:push:dry
```

`src` 기준 명시적 `any`, `as any`, `: any`, `Array<any>`, `Record<string, any>` 없음.

2026-05-07 migration 적용 전 guard patch:

- `move_club_record_ranking`는 임시 ranking position을 거쳐 unique 충돌 없이 순위를 이동한다.
- 초대 게스트 참가 흐름은 `join_club_record_event_guest_by_invite_code` RPC 경계로 묶였다.
- 참가자 insert/update는 `validate_club_record_event_participant` trigger로 event club과 member/guest club 일치 및 active member 조건을 검증한다.
- 월간 공개 카드 `win_rate`는 `0..100` percentage scale이고 UI는 추가 `* 100`을 하지 않는다.

DB smoke 결과:

- `supabase/tests/club_record_smoke.sql`
- 로컬 `psql`이 없어 Docker Postgres client로 실행했다.
  - `docker run --rm -i public.ecr.aws/supabase/postgres:17.6.1.106 psql "$SUPABASE_DB_PUSH_URL" -v ON_ERROR_STOP=1 < supabase/tests/club_record_smoke.sql`
- 스크립트는 `rollback`으로 끝나며, confirmed 삭제 방지/RLS-RPC 권한/늦참 배정/결과 입력 경로를 확인한다.
- smoke에는 ranking move, 클럽 회원 랭킹 동기화, cross-club participant insert 차단, 초대 게스트 참가 RPC, 월간 공개 카드 `win_rate` scale도 포함되어 있다.
- 히스토리 RPC는 게스트 참가자의 `display_name`을 partner/opponent 이름 배열에 포함해야 한다. UI 검증은 `/clubs/{clubId}/club-record/history`에서 게스트 이름이 보이는지 확인한다.
- 히스토리 RPC는 `team_names`에 본인/대상 회원을 첫 항목으로 포함해야 한다. smoke는 단식/복식 모두에서 `team_names` 순서를 검증한다.
- 최종 실행은 `ROLLBACK`으로 종료했고 테스트 데이터가 남지 않아야 한다.

## Known Open Items

작업을 쪼개서 진행한다. 한 번에 넓게 바꾸지 않는다.

- 2026-05-07 review findings 후속
  - ranking move unique collision: 보정 migration 반영, smoke 통과
  - invited guest join RLS/RPC path: 보정 migration 반영, smoke 통과
  - participant event/member club mismatch: pre-apply guard patch 반영, smoke coverage 추가
  - monthly card win rate scale: smoke 통과
  - archived/cancelled event monthly stats exclusion: fixture 추가, smoke 통과
  - club member ranking sync: 활성 정회원/운영진/방장 append, idempotency, non-admin 차단 smoke 추가
- confirmed 데이터 보존 smoke 테스트: 통과
- RLS/RPC smoke 테스트: 통과
- 결과 입력 UX 검증: 회원 본인 경기만 입력 가능, 운영진 전체 수정 가능, 다이얼로그/잠김 안내 반영 완료
- 월간 공개 카드 상세 화면 브라우저 검증
- 자동 편성 세부 알고리즘 고도화
- 최종 디자인 시스템 적용
- `/matches/new`, `/history`, `/leaderboard`의 legacy 진입 유지 여부와 폐기 시점 정리
- 새 `홈 / 이벤트 / 히스토리 / 클럽` IA에 대한 실제 브라우저 검증
- `/clubs/[clubId]/club-record/events` 이벤트 목록의 모바일/게스트 접근성 검증

## Next Recommended Task Split

다음 작업자는 아래 중 하나만 골라 작은 단위로 끝낸다.

1. 새 `홈 / 이벤트 / 히스토리 / 클럽` IA Playwright/browser 실사용 검증
2. 월간 공개 카드 상세 화면 Playwright/browser 실사용 검증
3. 결과 입력 UX Playwright/browser 실사용 검증

각 작업은 시작 전에 가정, 성공 기준, 검증 명령을 짧게 적고 진행한다.

## Next Agent Prompt

아래 텍스트를 다음 Codex 메인 작업자에게 그대로 전달해도 된다.

````text
You are the main Codex agent for tournament-record.

Working directory:
`/Users/minhyun/Desktop/tournament-record`

Task goal:
Continue `club_record` product work after DB apply/smoke completion. Do not re-apply migrations unless a new migration is intentionally added and approved.

Read first:
1. `CLAUDE.md`
2. `docs/club-record/07-handoff.md`
3. `docs/club-record/06-checklist.md`
4. `docs/club-record/03-schema.md`
5. `docs/club-record/04-access.md`
6. `supabase/tests/club_record_smoke.sql`
7. `supabase/migrations/20260506120000_add_club_record_core.sql`
8. `supabase/migrations/20260506121000_add_club_record_event_tables.sql`
9. `supabase/migrations/20260506122000_add_club_record_result_tables.sql`
10. `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
11. `supabase/migrations/20260507094500_fix_club_record_ranking_move.sql`
12. `supabase/migrations/20260507095500_fix_club_record_guest_join_conflicts.sql`
13. `supabase/migrations/20260507100500_fix_club_record_result_update_conflict.sql`

Hard rules:
- Follow `CLAUDE.md`.
- Do not re-run DB write commands unless the next task explicitly requires it.
- Do not run destructive git commands.
- Do not use `any`. Explicit `any`, `as any`, `: any`, `Array<any>`, `Record<string, any>` are forbidden.
- Keep changes surgical. Do not refactor unrelated code.

Current state:
- `club_record` feature code and minimal routes exist.
- `club_record` DB migration and follow-up RPC fixes have been applied to the main Supabase DB after explicit user approval.
- `supabase/schema.sql` has been synced from remote.
- `npm run db:push:dry` returns `Remote database is up to date.`
- `supabase/tests/club_record_smoke.sql` passed via Docker Postgres `psql` and ended with `ROLLBACK`.
- Recent verification passed:
  - `rg` explicit any scan: no source `any`
  - `npm run env:check`
  - `npm run db:smoke`
  - `npm run lint`
  - club-record util tests
  - `npm run build`
- Remaining DB regression candidates: none currently listed. Add new smoke cases as DB behavior changes.

Do:
1. Pick one next product task from `Next Recommended Task Split`.
2. Before editing, run or inspect `npm run db:push:dry` if DB assumptions matter.
3. If adding a new DB change, create a new migration and run dry-run before apply.
4. Update docs and dev log for meaningful changes.

Required verification:
```bash
rg -n "\bany\b|as any|: any|<any>|Array<any>|Record<string, any>" src eslint.config.mjs
npm run lint
npm run test -- src/features/club-record/utils/score.test.ts src/features/club-record/utils/slots.test.ts src/features/club-record/utils/assignment-pool.test.ts src/features/club-record/utils/auto-assignment.test.ts src/features/club-record/utils/assignment-board.test.ts src/features/club-record/utils/access.test.ts src/features/club-record/utils/date.test.ts
npm run build
npm run db:push:dry
```

DB smoke rerun command, only when DB regression validation is needed:
```bash
source scripts/automation/source-env.sh
docker run --rm -i public.ecr.aws/supabase/postgres:17.6.1.106 \
  psql "$SUPABASE_DB_PUSH_URL" -v ON_ERROR_STOP=1 < supabase/tests/club_record_smoke.sql
```

Final response format:
- Patches made, if any
- Verification results
- Remaining blockers
- Exact commands the next person can run
````
