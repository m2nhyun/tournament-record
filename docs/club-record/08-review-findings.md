# Club Record Review Findings

이 문서는 `club_record` migration/서비스/UI 초안에 대해 2026-05-07 리뷰에서 발견된 미해결 이슈를 추적한다.
코드 라인 번호는 변경 중 흔들릴 수 있으므로, 아래의 파일/함수/검색어를 기준으로 다시 확인한다.

## Review Snapshot

- 기준일: 2026-05-07
- 대상 범위:
  - `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
  - `src/features/club-record/services/participants.ts`
  - `src/features/club-record/services/guests.ts`
  - `src/features/club-record/components/club-record-dashboard.tsx`
- 현재 상태: 2026-05-08 기준 RF-001~RF-005는 보정 migration 또는 smoke fixture 보강 후 메인 DB smoke를 통과했다.

## RF-001 Ranking Move Unique Collision

- Severity: P1
- Status: resolved and smoke passed
- Area: DB function / ranking
- Primary file:
  - `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
- Inspect:
  - `move_club_record_ranking`
  - `club_record_members`의 `unique (club_id, ranking_position)`
  - `club_record_ranking_audits`

### Problem

`unique (club_id, ranking_position)`가 활성화된 상태에서 `move_club_record_ranking`가 같은 `UPDATE` 문 안에서 순위를 밀고 당기면 transient duplicate가 발생할 수 있다.
예를 들어 2위를 1위로 이동할 때 기존 1위 row가 2위로 업데이트되는 순간 기존 2위 row가 아직 남아 있어 PostgreSQL unique constraint가 실패할 수 있다.

### Expected Fix Direction

- 아래 중 하나로 충돌 없는 순위 이동을 보장한다.
  - `unique (club_id, ranking_position)`를 deferrable unique constraint로 전환하고 트랜잭션 종료 시 검증한다.
  - 이동 대상 row를 임시 ranking position으로 먼저 빼고, 나머지 row를 shift한 뒤 최종 위치에 배치한다.
- 인접한 위/아래 이동과 먼 순위 이동 모두 같은 함수에서 처리한다.
- 실패 시 audit row가 남지 않아야 한다.

### Done Criteria

- `move_club_record_ranking`가 2 -> 1, 1 -> 2, 5 -> 1, 1 -> 5 이동에서 unique violation 없이 통과한다.
- 이동 후 같은 club 안의 `ranking_position`은 중복 없이 연속된다.
- `recalculate_club_record_groups`와 ranking audit 기록이 기존 의미를 유지한다.
- smoke 또는 SQL 검증에 인접 순위 이동 케이스가 추가된다.

### Resolution

- `move_club_record_ranking`가 대상 row와 shift 대상 row를 임시 오프셋 구간으로 이동한 뒤 최종 순위를 채우도록 `20260507094500_fix_club_record_ranking_move.sql`에서 보정했다.
- `supabase/tests/club_record_smoke.sql`에 인접/원거리 ranking move와 중복/비연속 검사를 추가했고 메인 DB smoke에서 통과했다.

## RF-002 Invited Guest Join Blocked By RLS

- Severity: P1
- Status: resolved and smoke passed
- Area: RLS / guest invite / service boundary
- Primary files:
  - `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
  - `src/features/club-record/services/guests.ts`
  - `src/features/club-record/services/participants.ts`
- Inspect:
  - `verify_club_record_guest_invite_code`
  - `joinEventAsGuestByInviteCode`
  - `upsertGuestProfile`
  - `addGuestParticipant`
  - RLS policies for `club_record_guest_profiles`
  - RLS policies for `club_record_event_participants`

### Problem

초대코드 검증은 `verify_club_record_guest_invite_code` RPC로 가능하지만, 이후 `joinEventAsGuestByInviteCode`가 클라이언트에서 직접 `club_record_guest_profiles`와 `club_record_event_participants`에 write한다.
현재 RLS가 admin write 중심이면 비관리자 초대 게스트는 검증 이후 RLS violation으로 이벤트 참가를 완료하지 못한다.

### Expected Fix Direction

- 초대코드 검증, 게스트 프로필 upsert, 이벤트 참가 등록을 하나의 `security definer` RPC로 묶는다.
- RPC 내부에서 반드시 아래를 검증한다.
  - invite code가 active이고 만료되지 않았는지
  - invite가 가리키는 event가 `is_deleted=false`, `status <> 'cancelled'`인지
  - `guest_user_id = auth.uid()` 기준으로 본인 guest profile만 만들거나 재사용하는지
  - 같은 이벤트에 같은 guest profile이 중복 참가자로 등록되지 않는지
- 또는 같은 수준의 self-insert RLS를 추가하되, 초대코드 검증 없이 임의 이벤트에 참가 row를 만들 수 없어야 한다.

### Done Criteria

- 비관리자 authenticated/anonymous 게스트가 유효한 초대코드로 참가 가능하다.
- 잘못된 코드, 만료 코드, 비활성 코드, 삭제/취소 이벤트 코드는 참가 실패한다.
- 게스트가 초대받지 않은 이벤트에 직접 participant row를 만들 수 없다.
- 관리자/운영진의 수동 게스트 추가 경로는 기존처럼 동작한다.
- `supabase/tests/club_record_smoke.sql` 또는 별도 smoke에 guest invite join 성공/실패 케이스가 포함된다.

### Resolution

- `join_club_record_event_guest_by_invite_code` security definer RPC를 추가해 초대코드 검증, 게스트 프로필 upsert, 이벤트 참가 등록을 한 DB 경계로 묶었다.
- `verify_club_record_guest_invite_code`와 join RPC 모두 삭제/취소 이벤트와 만료/비활성 코드를 제외한다.
- `joinEventAsGuestByInviteCode` 서비스는 direct insert 대신 join RPC를 호출한다.
- `20260507095500_fix_club_record_guest_join_conflicts.sql`에서 join RPC의 `on conflict` ambiguity를 constraint 기반으로 보정했다.
- smoke에 비관리자 초대 게스트 참가 성공 케이스를 추가했고 메인 DB smoke에서 통과했다.

## RF-003 Participant Club Mismatch

- Severity: P2
- Status: resolved and smoke passed
- Area: RLS / participant integrity
- Primary files:
  - `src/features/club-record/services/participants.ts`
  - `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
- Inspect:
  - `addMemberParticipant`
  - RLS policy `club_record_event_participants_admin_all`
  - `club_record_event_participants` insert/check constraints
  - event club lookup in `club_record_events`
  - member club lookup in `club_members`

### Problem

운영진/관리자가 참가자를 추가할 때 클라이언트 insert는 임의의 `club_member_id`를 받을 수 있다.
RLS가 호출자가 이벤트의 club을 관리하는지만 확인하고, 입력된 `club_member_id`가 같은 club 소속인지 검증하지 않으면 다른 클럽 멤버를 이벤트 참가자로 붙일 수 있다.
이는 참가자 목록, 자동 편성, 월간 통계, 히스토리를 오염시킨다.

### Expected Fix Direction

- 참가자 추가를 RPC로 옮기고 RPC 내부에서 event club과 member club 일치를 검증한다.
- 또는 trigger/check helper/RLS `with check`에서 `club_record_events.club_id = club_members.club_id`를 강제한다.
- inactive member는 참가자로 추가할 수 없어야 한다.

### Done Criteria

- 같은 club의 active member만 member participant로 추가된다.
- 다른 club member, inactive member, soft-deleted member insert는 DB 경계에서 실패한다.
- 클라이언트 드롭다운 필터를 우회한 crafted insert도 실패한다.
- 이 조건이 smoke SQL에 포함된다.

### Resolution

- `validate_club_record_event_participant` trigger를 추가해 참가자 insert/update 시 event club과 member/guest club 일치 및 active member 조건을 DB에서 강제한다.
- smoke에 운영진 권한으로 crafted cross-club member participant insert가 실패하는 케이스를 추가했고 메인 DB smoke에서 통과했다.

## RF-004 Monthly Card Win Rate Scale

- Severity: P2
- Status: resolved and smoke passed
- Area: UI / RPC contract
- Primary files:
  - `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
  - `src/features/club-record/services/dashboard.ts`
  - `src/features/club-record/services/history.ts`
  - `src/features/club-record/components/club-record-dashboard.tsx`
- Inspect:
  - `get_club_record_monthly_public_card` return column `win_rate`
  - monthly card DTO mapping `winRate`
  - dashboard render text for 승률

### Problem

`get_club_record_monthly_public_card`가 `win_rate`를 `* 100`한 percentage 값으로 반환하는 경우 UI에서 다시 `entry.winRate * 100`을 적용하면 승률이 100배 커진다.
예: RPC 값이 `50`이면 UI가 `5000%`를 표시한다.

### Expected Fix Direction

- contract를 하나로 고정한다.
  - Option A: SQL은 `0..100` percentage를 반환하고 UI는 `Math.round(entry.winRate)%`만 표시한다.
  - Option B: SQL은 `0..1` ratio를 반환하고 UI가 `* 100`을 적용한다.
- 문서/타입/서비스 변수명에 같은 scale을 명시한다.

### Done Criteria

- 1승 1패 0무 케이스가 UI에서 `50%`로 표시된다.
- `win_rate` contract가 `03-schema.md` 또는 관련 service type comment에 기록된다.
- 월간 카드 DTO mapping과 dashboard render가 같은 scale을 사용한다.

### Resolution

- SQL/RPC contract를 `0..100` percentage scale로 유지하고, UI는 `entry.winRate`를 다시 `* 100`하지 않도록 수정했다.
- `docs/club-record/03-schema.md`와 `ClubRecordMonthlyCardEntry.winRate` 타입 주석에 scale을 기록했다.
- smoke에 월간 공개 카드 `win_rate` percentage scale 검사를 추가했고 메인 DB smoke에서 통과했다.

## RF-005 Archived Events Counted In Monthly Stats

- Severity: P2
- Status: resolved and smoke passed
- Area: stats / public card / archived data
- Primary file:
  - `supabase/migrations/20260506123000_add_club_record_rls_and_functions.sql`
- Inspect:
  - `get_club_record_monthly_public_card`
  - `archiveClubRecordEvent`
  - `club_record_events.is_deleted`
  - `club_record_events.status`
  - member-stat refresh helper

### Problem

삭제/취소된 이벤트의 confirmed matches가 월간 공개 카드에 계속 집계되면, 운영진이 숨긴 이벤트가 공개 통계에 남는다.
리뷰 시점의 지적은 monthly public card query가 club/date/status만 보고 `e.is_deleted = false`를 누락할 수 있다는 것이다.

### Current Observation

현재 migration과 schema의 `get_club_record_monthly_public_card`에는 `e.is_deleted = false`와 `e.status <> 'cancelled'` 조건이 유지된다.
2026-05-08 smoke fixture에 deleted event와 cancelled event의 confirmed match를 추가했고, 월간 공개 카드가 해당 경기들을 집계하지 않는 것을 확인했다.

### Expected Fix Direction

- monthly public card stats query에 아래 조건을 유지한다.
  - `e.is_deleted = false`
  - `e.status <> 'cancelled'`
  - `m.status = 'confirmed'`
- member-stat refresh logic과 공개 카드 집계 기준을 일치시킨다.

### Done Criteria

- archived event의 confirmed match가 월간 공개 카드에 포함되지 않는다.
- cancelled event/match가 회원/게스트 public stats에 포함되지 않는다.
- smoke SQL 또는 별도 DB 검증에 archived event exclusion 케이스가 포함된다.

### Resolution

- `supabase/tests/club_record_smoke.sql`에 deleted event와 cancelled event 각각의 confirmed match fixture를 추가했다.
- 월간 공개 카드 owner row가 excluded fixture를 무시하고 `2승 0패 1무`, `win_rate ~= 67`을 유지하는지 검증한다.
- Docker Postgres `psql` smoke가 `ROLLBACK`으로 통과했다.

## Review Verification Checklist

다음 작업자는 수정 여부를 판단할 때 최소 아래 순서로 확인한다.

1. `docs/club-record/07-handoff.md`의 최신 handoff를 읽는다.
2. 위 각 RF 항목의 `Primary files`와 `Inspect` 대상을 연다.
3. SQL 함수/RLS/service/UI contract가 같은 의미를 갖는지 확인한다.
4. 필요한 경우 `supabase/tests/club_record_smoke.sql`에 누락된 regression case를 추가한다.
5. DB 변경이 있으면 `npm run db:push:dry`를 먼저 실행하고, 실제 DB apply는 명시 승인 전에는 하지 않는다.

권장 검증 명령:

```bash
npm run lint
npm run test -- src/features/club-record/utils/score.test.ts src/features/club-record/utils/slots.test.ts src/features/club-record/utils/assignment-pool.test.ts src/features/club-record/utils/auto-assignment.test.ts src/features/club-record/utils/assignment-board.test.ts src/features/club-record/utils/access.test.ts src/features/club-record/utils/date.test.ts
npm run build
npm run db:push:dry
```

DB migration을 로컬/스테이징에 적용한 뒤에는 아래 smoke를 실행한다.

```bash
psql "$SUPABASE_DB_PUSH_URL" -f supabase/tests/club_record_smoke.sql
```

실제 운영 DB에 적용하거나 smoke를 실행할 때는 별도 승인을 먼저 받는다.
