# Dev Log

## Pending User Decisions / Actions (2026-06-08 기준)

다음 세션 시작 시 이 섹션을 먼저 읽으면 현재 위치와 결정 대기 항목이 한눈에 보인다. 결정이 끝난 항목은 이 섹션에서 제거하고 본 dev-log 항목으로 이관한다.

### A. 운영 DB 미반영 migration 일괄 적용 — 완료 (2026-06-09)

운영 DB(`nomcsuizsztyhxkehila`)에 5개 migration 모두 적용 완료.

1. ✅ `20260608120000_restrict_anon_function_grants.sql`
2. ✅ `20260609120000_add_match_schedule_cancel_by_host.sql`
3. ✅ `20260609130000_add_update_club_record_match_players.sql`
4. ✅ `20260609140000_add_get_my_next_club_record_match.sql`
5. ✅ `20260609150000_add_gender_to_participants_rpc.sql` (`drop function if exists` 추가하여 `RETURNS TABLE` 시그니처 변경 SQLSTATE 42P13 fix)

남은 후속 작업(blocking 아님, 환경에 따라 사용자 처리):
- **`supabase/schema.sql` sync**: `db-sync-schema.sh`가 Docker로 pg_dump 컨테이너를 띄움. 현재 Docker daemon이 미실행이라 sync 미완료. Docker 실행 후 `npm run db:push`(추가 migration 없어도 됨) 또는 `bash scripts/automation/db-sync-schema.sh` 단독 실행으로 사후 sync 가능. schema.sql과 운영 DB가 일시 불일치이지만 서비스 동작에는 영향 없음.
- **`db:smoke:sql` 회귀 검증**: 시스템에 `psql`이 미설치되어 실행 불가. `psql` 또는 Postgres client 설치 후 재시도 가능. 운영 영향은 없음(앱 동작 검증은 사용자 브라우저로 가능).

**추가 확인 항목**: 참가자 도착 시간 변경(2차)은 별도 migration 없이 `club_record_event_participants.arrival_time`을 직접 update한다. 적용 후:
  - 운영진/관리자 권한으로 update가 RLS를 통과하는지 (예상: existing admin policy로 통과)
  - update 시 `handle_club_record_assignment_dirty_sync` trigger가 `assignment_dirty=true`를 설정하는지 (안 되면 후속 trigger migration 필요)

사용자가 실행할 명령(env에 `SUPABASE_DB_PUSH_URL` 설정 필요):
```bash
npm run db:push:dry   # 1) 미리 확인 — 2개 migration이 보여야 함
npm run db:push       # 2) 적용 (schema.sql 자동 sync)
npm run db:smoke:sql  # 3) anon 권한 회귀 검증 (#1)
# #2의 회귀 검증(cancel_match_schedule)은 smoke에 아직 없음. 수동 검증:
#   - 호스트로 일정 취소 → 성공
#   - 비호스트로 호출 → '일정 개설자만 취소할 수 있습니다.'
#   - cancelled 상태에서 재호출 → idempotent (에러 없음)
```

실행 후 작업자가 처리해야 할 일:
- 위 단계 모두 성공하면 본 dev-log 2026-06-08 P1-A와 2026-06-09 P1-B 항목의 "운영 DB 적용 대기"를 "운영 DB 적용 완료 (날짜)"로 갱신.
- 다음 호스트 액션(모집 마감/일정 수정)이 추가될 때 그 migration도 같은 사이클에 묶어 적용.

### C. P1-A 다음 항목: core matches RPC 트랜잭션화 (사용자가 "건너뛰기"로 결정한 항목)

- 현재 상태: 사용자가 P1-A scope 결정 단계에서 "core matches 건너뛰고 audit→profile 순"으로 결정했으므로 이번 사이클에서는 진행하지 않음.
- 재평가 시점: `matches` 보조 트랙의 실제 사용량이 늘어나거나 partial-write/race 사고가 생기면 다시 우선순위 재평가.

### D. P1-C: 테스트 보강 (P1-A 완료 후)

- service mock 테스트 추가 (`src/features/*/services`의 Supabase 호출 회귀 방지)
- core match/schedule/profile SQL smoke 추가

### E. P1-B: UX 후속 액션 (P1-A, P1-C 완료 후)

- 호스트 관리 액션 (일정 취소/마감/수정)
- 일정 → 실제 경기 연결
- 클럽 도입 퍼널 단순화
- 정모 직후 기록 UX 압축
- 미확정 경기 후속 처리 강화

---

## 2026-06-09

### chore(db): 운영 DB에 P1-A/P1-B migration 5개 일괄 적용

- `npm run db:push:dry`로 5개 migration이 push 대기인 것 확인 후 `npm run db:push` 실행.
- 처음 시도에서 #5 `add_gender_to_participants_rpc.sql`이 SQLSTATE 42P13 `cannot change return type of existing function`로 실패. PostgreSQL은 `CREATE OR REPLACE FUNCTION`으로 `RETURNS TABLE`의 컬럼 추가/변경을 허용하지 않음(`Hint: Use DROP FUNCTION first.`).
- migration #5 본문에 `drop function if exists public.get_club_record_event_participants(uuid);` 한 줄을 `create function` 위에 추가. 다른 DB object에서 이 함수에 의존하지 않음을 grep으로 확인했기 때문에 drop이 안전.
- 재시도 후 #5도 적용 완료. 어제부터 대기 중이던 5개 migration이 모두 운영 DB에 반영됨.
- 후속 미완료 항목(서비스 영향 없음):
  - `supabase/schema.sql` sync: Docker daemon 미실행으로 `db-sync-schema.sh`가 pg_dump 컨테이너를 못 띄움. Docker 실행 후 재시도 필요.
  - `db:smoke:sql`: `psql` 미설치로 실행 불가. Postgres client 설치 후 재시도 가능.

### fix(club-record): "내 다음 경기" fetch 실패가 대시보드 전체를 깨뜨리던 버그 + 정회원 문구 단순화

사용자 보고: "club record 처리 중 오류가 발생했습니다." 가 떠서 대시보드 자체가 열리지 않음.

root cause:
- `getClubRecordDashboardData`가 새로 추가된 `get_my_next_club_record_match` RPC를 무조건 호출하고, 실패 시 throw → 대시보드 fetch 전체가 실패해 catch-all 오류 메시지로 떨어짐.
- 운영 DB에는 어제 push한 5개 migration이 아직 적용되지 않은 상태라, `get_my_next_club_record_match`가 존재하지 않아 PGRST `Could not find the function ...` 에러 발생.

진짜 fix:
- `src/features/club-record/services/dashboard.ts`: `fetchNextMatch` 호출을 `try/catch`로 감싸 실패 시 `nextMatch = null`로 graceful degrade. 카드만 안 보이고 나머지(access/events/monthly card)는 정상 로드. 에러는 `console.warn`로 남겨 추적 가능.
- 즉 운영 DB에 migration이 적용되기 전에도 대시보드가 멀쩡하게 열린다. 적용 후엔 자동으로 "내 다음 경기" 카드가 노출된다.

문구 정리(사용자 요청: "정회원 (카카오/이메일 로그인)" 같은 영문/괄호 부연은 제거):
- 7곳 일괄 정리: `match-creation-form.tsx`, `match-schedule-form.tsx` description, `clubs/hooks/use-club-dashboard.ts`(2곳: 게스트 안내/생성 거부), `schedules/services/schedules.ts`, `matches/services/matches.ts`(3곳: 생성/수정/삭제), `auth/services/auth.ts`(`requireRegisteredUser`). 모두 "카카오/이메일" 부연을 빼고 "정회원"으로 통일.

검증: `npm run verify` 통과(test 67/67, lint 0 errors, build 성공). DB 변경 없음.

### UX/copy: club_record 오류 메시지 톤 정리 + EmptyState 가독성

사용자 보고:
- "club record 처리 중 오류가 발생했습니다." 라는 generic 메시지가 노출됨.
- 클럽 탭 `예정된 일정이 없습니다` 다음 줄 텍스트에 좌우 padding 부족, 긴 문장은 자연 줄바꿈이 안 됨.

대응:
- `src/features/club-record/services/errors.ts`
  - `mapCommonClubRecordMessage`에 케이스 추가:
    - `Could not find the function` / `function ... does not exist` / `schema cache` / `PGRST202` → `최신 DB 업데이트가 아직 반영되지 않았습니다. 운영진에게 알려주세요.` (운영 DB에 새 RPC 미적용 시 가장 흔한 원인)
    - `permission denied` / `권한이 없` → `이 작업을 수행할 권한이 없습니다.`
  - catch-all 메시지를 "club record 처리 중 오류가 발생했습니다." → `데일리 매치 처리 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.` 로 정리 (영어 도메인 표현 제거 + 다음 액션 안내).
  - `toClubRecordErrorMessage`의 fallback도 동일 톤으로 정리.
- `src/components/feedback/empty-state.tsx`
  - outer container에 `px-6` 추가 (좌우 패딩 부재 문제 해결).
  - description `p`에 `whitespace-pre-line max-w-sm mx-auto leading-relaxed` 적용. `\n`을 줄바꿈으로 렌더하고, 너무 좁은 폭에서도 가운데 정렬 + 자동 줄바꿈.
- 명확하게 긴 description 3곳에 `\n`으로 자연스러운 분리 적용:
  - `club-schedule-list.tsx` (사용자 명시 위치)
  - `match-creation-form.tsx`(게스트 안내)
  - `match-schedule-form.tsx`(게스트 안내)
- 검증: `npm run verify` 통과(test 67/67, lint 0 errors, build 성공). DB 변경 없음.
- 추적 노트: 사용자가 본 "club record 처리 중 오류" 메시지의 정확한 발생 화면은 미확인. 운영 DB에 대기 중인 migration 5개가 적용되기 전이라면 새 RPC 호출(예: `get_my_next_club_record_match`, `update_club_record_match_players`) 시 위 `Could not find the function` 매핑으로 잡혀 더 친절한 메시지가 노출된다.

### P1-B 6차: 자동 편성에 여복/혼복 성별 균형 룰 추가

- 사용자 운영 규칙: 여자 4·5명 → 1경기 여복, 6·7명 → 2경기, 8·9명 → 3경기. 일반화: `target = max(0, floor((femaleCount - 2) / 2))`. 나머지 매치는 가능하면 sides 1여1남으로 균형.
- 데이터 흐름 변경:
  - migration `20260609150000_add_gender_to_participants_rpc.sql`: `get_club_record_event_participants` RPC가 `gender` 컬럼을 반환. 회원은 `user_profiles.gender`, 게스트는 `club_record_guest_profiles.gender`에서 가져옴(`male`/`female`/`unspecified`/null).
  - `ClubRecordEventParticipant.gender` 필드 추가, service `participants.ts`에 `normalizeGender` + row→entity mapping 보강.
- 알고리즘 변경(`auto-assignment.ts`):
  - 신규 헬퍼: `computeWomenMatchTarget(participants)`, `countExistingAllFemaleMatches(participants, slots)`, `isAllFemaleQuartet(quartet)`.
  - `planClubRecordAutoAssignments` 진입 시 `WomenMatchContext = { current, target }`를 계산. 슬롯 처리 후 quartet이 전원 여성이면 `current += 1`.
  - `getQuartetScore`: 전원 여성 quartet이고 `current < target`이면 `-200_000` 보너스(강한 우선). 충족 후엔 보너스 없음(혼복으로 자연 회귀).
  - `getPairingScore`: quartet이 여성 2 + 남성 2일 때 두 페어 모두 (남,여) 혼합이면 `-10_000` 보너스(혼복 sides 균형).
  - 기존 룰(같은 페어 반복 +100k, 4인 조합 2회 초과 +50k, 시간대 동시 출전 하드 차단, 그룹 spread 등)은 변경 없음.
- 테스트 추가(`auto-assignment.test.ts`, 신규 3개):
  - 여자 4명+남자 4명/2슬롯: 여복 매치 ≥ 1
  - 여자 6명+남자 4명/4슬롯: 여복 매치 ≥ 2
  - 여자 3명만: 여복 매치 = 0(target 미달이면 강제 안 함)
- 검증: `npm run verify` 통과(test 67/67, lint 0 errors, build 성공).
- 운영 DB apply 후 회귀: `get_club_record_event_participants`의 신규 `gender` 컬럼이 반환되는지(클라이언트가 row mapping에 의지하므로 누락 시 fallback null).

### P1-B 5차: 클럽 홈 "내 다음 경기" 카드 (개인 코트 확인 2단계)

- 워크스페이스 본인 강조(3차)에 이어, 회원이 클럽 홈(`/clubs/[clubId]`)에서 바로 "다음 경기는 몇 시, 몇 번 코트, 누구와"를 확인할 수 있게 했다.
- 신규 RPC `get_my_next_club_record_match(p_club_id uuid)` (`supabase/migrations/20260609140000_add_get_my_next_club_record_match.sql`):
  - `get_my_active_club_member_id` → `club_record_event_participants` → `club_record_match_players` 조인.
  - 매치 status='pending_result', slot.ends_at > now(), 이벤트 deleted/cancelled 제외.
  - 가장 가까운 slot.starts_at 1건만 반환.
  - 반환 컬럼: `court_number`, `slot_starts_at/ends_at`, `my_side`, `team_one_names[]`, `team_two_names[]`. 회원은 `club_members.nickname`, 게스트는 `club_record_guest_profiles.display_name`로 이름 매핑.
  - `authenticated`에만 EXECUTE.
- service: `getClubRecordDashboardData`가 `access.clubMemberId`가 있을 때만 `fetchNextMatch` 호출(게스트 anonymous는 호출 안 함).
- types: `ClubRecordDashboardNextMatch` 추가, dashboard data에 `nextMatch` 필드.
- UI: club_record 대시보드의 상태 카드와 "현재 이벤트" 섹션 사이에 카드 삽입. 코트 번호는 brand Badge로 강조, 시간 범위 + 이벤트 제목 + 내 팀/상대 라인 + 이벤트 열기 링크.
- 검증: `npm run verify` 통과(test 64/64, lint 0 errors, build 성공). 운영 DB apply는 사용자 명시 승인 대기.

### P1-B 4차: 운영진 매치 선수 교체 (`update_club_record_match_players` RPC + UI)

- 사용자 운영 흐름 직결: 20시 화이트보드 매칭 중 도착/요청 변화로 매치 선수 swap이 자주 발생. 기존엔 매치 삭제 후 수동 재생성만 가능했음.
- 신규 RPC `update_club_record_match_players(p_match_id uuid, p_players jsonb)` (`supabase/migrations/20260609130000_add_update_club_record_match_players.sql`):
  - admin/manager만 호출.
  - 매치 status가 `pending_result`여야 함(confirmed/cancelled는 거부).
  - 새 4명 모두 같은 이벤트 active participant + 도착시간 ≤ slot.starts_at 검증.
  - `delete from club_record_match_players where match_id` 후 `is_club_record_participant_occupied_at_slot_start`로 occupancy 검증. 자기 매치를 mid-state로 제외하는 효과.
  - 매치를 `assignment_mode='manual'`, `is_manual=true`로 표시(운영진이 auto plan을 손댄 결과).
  - `mark_club_record_event_assignment_dirty`로 dirty flag set → UI에서 재편성 권장 prompt.
  - `authenticated`에만 EXECUTE grant.
- service: `updateMatchPlayers(matchId, players)` 추가. 클라이언트에서 4명 distinct 사전 검증.
- UI: `ClubRecordMatchControls`의 DropdownMenu에 `선수 변경` 메뉴 추가(미확정 매치에서만 노출). 클릭 시 Modal에서 4 popover로 새 4명 선택. 옵션 풀: `swapEligibleParticipantIds`(workspace에서 같은 시간대 available + 현재 매치 4명을 union해 props로 내려줌).
- 검증: `npm run verify` 통과(test 64/64, lint 0 errors, build 성공). 운영 DB apply는 사용자 명시 승인 대기.

### P1-B 3차: 워크스페이스에서 "내 경기" 명시 (개인 코트 확인 1단계)

- 사용자 요구: "개인은 어떤 코트에서 경기를 하는지 알면 좋을 거 같다" — 코트번호 1~5 중 본인이 어느 코트로 가야 하는지 시각적으로 한눈에 보여야 한다.
- 1단계로 이벤트 워크스페이스(`ClubRecordEventWorkspaceView`)의 슬롯 카드에서:
  - 본인 `participantId`가 포함된 슬롯 카드 헤더에 `내 경기` Badge를 추가.
  - 팀 1/팀 2 선수 이름 목록에서 본인 이름을 `font-semibold text-[var(--player-highlight)]`로 강조하고 `(나)` 접미. 히스토리 카드와 동일한 강조 토큰을 재사용해 시각 일관성 유지.
- 데이터 흐름: `access.clubMemberId` → `workspace.participants`에서 `clubMemberId` 매칭 → `myParticipantId`. 게스트(anonymous) 진입 시 `clubMemberId`가 null이라 자연히 강조 안 됨(정상).
- 다음 단계(예정): 클럽 홈 대시보드에 "내 다음 경기" 카드(코트 + 시간 + 팀 구성)를 추가하여 워크스페이스에 진입하지 않아도 코트를 파악할 수 있게 한다.
- 검증: `npm run verify` 통과(test 64/64, lint 0 errors, build 성공). DB 변경 없음.

### P1-B 2차: 참가자 도착 시간 변경 UI (당일 교통 변수 대응)

- 운영 현장에서 참가자가 19시/19:30/20시 등 다양한 시각에 도착하고 당일 교통 변수가 자주 발생한다는 사용자 요구를 반영. 한 번 도착시간을 입력한 뒤에도 운영진이 손쉽게 수정할 수 있게 했다.
- 신규 service 함수: `updateParticipantArrivalTime(participantId, arrivalTime: string | null)`. `club_record_event_participants.arrival_time`을 직접 update (정시 참가는 null). RLS에 의지해 admin/manager 권한 통제.
- UI: `ClubRecordParticipantManager` 각 참가자 행에 `시간` 버튼 추가. 클릭 시 Modal에서 `정시` + 30분 단위 시간 그리드(기존 추가 다이얼로그와 동일 패턴)로 새 도착시간 선택 → 저장. description에 "변경 후 자동 편성을 다시 실행해주세요" 안내 포함.
- 검증: `npm run verify` 통과(test 64/64, lint 0 errors, build 성공).
- 운영 DB apply 후 확인할 부분: `handle_club_record_assignment_dirty_sync` trigger가 participant UPDATE에도 dirty=true를 설정하는지 (안 되어 있으면 후속 trigger migration 필요).

### P1-B 1차: 호스트 일정 취소 액션 (`cancel_match_schedule` RPC + UI)

- 일정 상세(`/clubs/[clubId]/schedules/[scheduleId]`)에서 호스트가 자기 일정을 취소할 수 있게 했다. UX-tasks Backlog 6번의 "일정 취소"가 1차 완료.
- 신규 RPC `cancel_match_schedule(p_schedule_id uuid)` (`supabase/migrations/20260609120000_add_match_schedule_cancel_by_host.sql`):
  - 호출자가 active `club_member`이고 그 `id`가 `match_schedules.host_member_id`와 일치해야 한다.
  - 이미 cancelled면 idempotent. `ends_at`이 지난 일정은 취소 거부.
  - `authenticated`에만 EXECUTE grant. anon 화이트리스트(§2-1)에 따라 anon은 부여하지 않음.
- 서비스: `cancelMatchSchedule(scheduleId)` 추가. `requireCompletedProfile` 가드 → RPC 호출 → `mapScheduleError`로 에러 매핑.
- UI: `MatchScheduleDetailView`의 호스트 안내 placeholder를 실제 액션 영역으로 교체. `cancelled` 상태가 아닐 때만 `일정 취소` 버튼 노출, 클릭 시 `AlertDialog`로 한 번 더 확인. 참가자/신청 내역은 기록을 위해 보존됨을 description에 명시.
- 검증: `npm run verify` 통과(test 64/64, lint 0 errors, build 성공). 운영 DB 적용은 사용자 명시 승인 대기.
- 남은 호스트 액션: 모집 마감, 일정 수정, 일정→실제 경기 연결.

### P1-C 1차: profile service mock 테스트 추가

- `src/features/auth/services/profile.test.ts` 신규: `requireCompletedProfile`, `getMyProfile`, `isProfileComplete`의 가드 경로를 vitest mock으로 검증.
- 검증 케이스 11개:
  - `requireCompletedProfile`: 로그아웃 / anonymous / row 없음 / profile_completed=false / true / PGRST116 외 error 전파
  - `getMyProfile`: 로그아웃 + anonymous는 DB 호출 없이 null / PGRST116 → null
  - `isProfileComplete`: 누락 → false / true → true
- 패턴: 기존 `auth.test.ts`의 `vi.hoisted` + mock chain 패턴을 재사용. 다른 service의 mock test도 같은 패턴으로 확장 가능.
- 검증: `npx vitest run profile.test.ts` 11/11 통과.
- 나머지 club-record/clubs/schedules service mock test는 supabase chain mock의 ROI가 낮다고 판단되어 보류. 비즈니스 분기는 utils 추출 → utility test 패턴이 더 깔끔.

### P1-A: profile_completed 가드 정책 — 서비스 계층 유지로 확정

- 결정: `requireCompletedProfile()` 서비스 계층 가드가 최종 경계. DB/RPC 수준에서는 강제하지 않는다.
- 결정 근거:
  - 위협 모델이 좁다 (정회원 + 프로필 미완성 + 콘솔 직접 호출).
  - JWT-less 우회는 2026-06-08 anon function grant 화이트리스트로 차단.
  - 9개 서비스 함수 전체에 DB 가드 추가는 작업양 대비 ROI 낮음.
- 반영: `docs/09-keep-rules.md` §1-1에 정책 명문화. 새 핵심 쓰기 서비스 추가 시 `requireCompletedProfile()` 호출 잊지 않는다는 운영 규칙 포함.
- 재평가 시점: 정회원 우회 사고가 실제로 발견되면 옵션 2/3 재검토.

## 2026-06-08

### P1-A: anon function grant 화이트리스트화 (migration 작성, 운영 DB 적용 대기)

- `supabase/migrations/20260608120000_restrict_anon_function_grants.sql` 추가. `public` 스키마의 모든 함수에서 `anon` EXECUTE를 일괄 REVOKE하고 `ALTER DEFAULT PRIVILEGES`로 향후 추가 함수의 자동 anon grant도 차단한다. 그 다음 게스트 초대 흐름에 필요한 4개 RPC만 화이트리스트로 다시 GRANT한다.
  - `join_club_by_invite(text, text)`
  - `join_club_by_invite_as_guest(text, text)`
  - `verify_club_record_guest_invite_code(text)`
  - `join_club_record_event_guest_by_invite_code(text, text, text, text, club_record_group_code, timestamptz)`
- `supabase/tests/club_record_smoke.sql`에 anon 권한 회귀 검증 섹션 추가: `has_function_privilege`로 화이트리스트 4개는 통과하고 `move_club_record_ranking` / `remove_club_member`는 차단되는지 확인한다.
- `docs/09-keep-rules.md`에 §2-1 "Function EXECUTE 권한 — anon 화이트리스트" 절을 추가해 향후 RPC 추가 시 anon grant 정책을 명문화했다.
- 배경: 기존 schema dump는 60+ public function 전부에 `anon` EXECUTE를 부여하고 있었다. 함수 내부 권한 가드가 약한 RPC가 한 개라도 있으면 익명 우회 위험이 생기므로 default-deny + 명시 화이트리스트로 전환.
- 클라이언트 영향: 없음. anonymous 사용자(`signInAnonymously`)는 JWT role 기준 `authenticated`로 들어오기 때문에 영향받지 않는다. `anon` role은 JWT-less 호출에만 적용되며, 게스트 초대 진입(`/join`, `/club-record/join`) 흐름만 anon 호출을 사용한다.
- 검증: `npm run verify` 통과(코드 변경 없음). 운영 DB 적용은 사용자 명시 승인 대기.
- 미완료: `npm run db:push` 실행 → `supabase/schema.sql` 동기화 → `npm run db:smoke:sql`로 회귀 통과 확인.

### P0 IA 정리 — legacy 라우트 제거 + cross-track 진입점 단절

- `/clubs/[clubId]/leaderboard` 라우트와 `src/features/leaderboard/*` 전체(components/hooks/services/types)를 삭제했다. 바텀 네비/링크 어디에서도 참조되지 않는 orphan 라우트였다.
- `MatchConfirmationPromptCard`를 `club-record-dashboard.tsx`에서 제거하고 컴포넌트 파일 자체도 삭제했다. club_record 메인 대시보드에서 legacy `/history`로 점프하던 cross-track 진입점이 이로써 사라진다. 일반 경기 확인 요청은 `/history` 화면의 `MatchConfirmationInboxAction`(상단 inbox 액션)에서 자체적으로 처리한다.
- `docs/01-product-canvas.md`에 **용어 정의(Glossary)** 섹션을 추가했다: `이벤트`(club_record), `일정`(schedules), `새 경기`(legacy `/matches/new`), `club_record 히스토리`, `일반 경기 히스토리`의 경계를 표로 고정. 보조 트랙 진입 경로 설명도 cross-track 카드 제거 사실에 맞춰 갱신.
- legacy `/history`, `/matches/*`, `/schedules/*` 보조 트랙은 바텀 네비에 노출하지 않고 URL 직접 접근 + 일정 카드 내부 링크로만 진입하는 닫힌 시스템으로 유지하기로 명문화했다.
- 검증: `npm run verify`(test 53/53, lint 0 errors, build 성공). 라우트 목록에서 `/leaderboard` 사라짐 확인.
- 이번 변경에는 DB/RLS 수정이 없다.

## 2026-05-27

### docs 전수 검증 및 stale 항목 갱신 (2회차)

- 5개 검증 에이전트를 병렬로 띄워 `docs/` 전체(6,064 LOC)를 코드/마이그레이션/스크립트와 대조했다. 발견된 불일치를 일괄 정리.
- `docs/01-product-canvas.md`:
  - 이벤트 상태 전이에 누락됐던 `draft`/`in_progress`를 추가.
  - 결과 입력 흐름이 club_record(`pending_result → confirmed`)와 일반 matches(`submitted → confirmed/disputed`)를 혼동하던 부분을 분리.
  - 비범위에서 "카카오 비범위, 이메일 OTP 사용 중" 표기를 제거(실제로는 둘 다 활성).
- `docs/05-automation.md`:
  - 명령어 표에 `db:smoke:sql`을 추가하고 `verify` 설명을 `test + lint + build`로 갱신.
  - Club Record SQL Smoke 섹션이 wrapper script(`npm run db:smoke:sql`)를 우선 안내하도록 수정.
- `docs/07-auth-handoff.md`: 2026-04-02 user_profiles/onboarding 흐름과 카카오 logout 분기를 archive 차이 항목에 반영.
- `docs/11-auth-onboarding-design.md`: `/auth/check-email`, `/auth/reset-password` 미구현 상태 명시. `profile_completed` DB 강제는 미도입(서비스 계층만 차단).
- `docs/12-project-review.md`: Diagnosis/마찰/CI 게이트/Risk Register/Release Readiness/P2 사용성 항목을 모두 2026-05-27 코드 상태로 재정렬.
- `docs/08-ux-tasks.md`: 4) 히스토리 뷰 개선에 `team_names`/club_record 무한 스크롤(2026-05-19) 완료 사실을 추가. Backlog(P0) 0)의 native select 후속 액션을 완료로 정정.
- `docs/club-record/03-schema.md`: Migration Split에 후속 fix 5개(`fix_ranking_move`, `fix_guest_join_conflicts`, `fix_result_update_conflict`, `fix_history_guest_names`, `add_history_team_names`)를 추가.
- `docs/club-record/06-checklist.md`: Apply Order를 실제 운영 적용 순서(11개)와 맞춤.
- `docs/club-record/07-handoff.md`: snapshot 기준일을 2026-05-22로 갱신, native select 전환 항목을 완료로 정리, Next Recommended Task Split에서 완료된 1번 작업 제거.
- `docs/club-record/05-implementation.md`: Suggested Hook Files에 `use-club-record-monthly-card.ts` 추가.

### 문서-코드 정합성 갱신 + 마지막 window.confirm 제거

- `docs/12-project-review.md`(2026-05-14)의 진단을 코드 현재 상태로 재검증하고 stale 항목을 갱신했다.
  - CI/`verify`에 test 포함, `eslint-config-next` 정렬, `packageManager` npm 일관성, `db:smoke` npm script 승격, native select/`<details>` 0건은 이미 모두 해소되어 있었다.
  - 미해결 P0는 legacy IA 정책(특히 `MatchConfirmationPromptCard` cross-track, `/leaderboard` orphan)으로 좁혀졌다.
- `src/features/clubs/components/club-member-list.tsx`의 멤버 제외 `window.confirm`을 공통 `AlertDialog`로 전환했다. src 전체 `window.confirm` 0건.
- `docs/01-product-canvas.md`에 matches 보조 트랙(`/matches/*`, `/history`, `/schedules/*`)을 명시했다.
- `docs/08-ux-tasks.md`의 primitive 전환 항목을 "완료"로 정리하고 최근 업데이트에 갱신 사실을 남겼다.

## 2026-05-22

### Native Select 전면 교체 — UI Primitive 통일

- `ClubRecordTimeSelect`에 `placeholder` prop을 추가해 선택 전 안내 문구를 표시할 수 있게 했다.
- `match-schedule-form.tsx` 시작/종료 시간 native `<select>` 2개를 `ClubRecordTimeSelect`(Popover 기반)로 교체했다. 이미 만들어진 컴포넌트를 재사용했다.
- `club-record-participant-manager.tsx` 늦참 시간 native `<select>` 2개(회원/게스트)를 버튼 그리드로 교체했다. "정시" + 30분 단위 시간 버튼, 선택 상태 토글.
- `club-record-participant-manager.tsx` 게스트 그룹 native `<select>`(A/B/C/미지정)를 4개 토글 버튼으로 교체했다.
- `club-record-match-controls.tsx` 수동 경기 선수 선택 native `<select>` × 4를 각각 Popover + 이름 목록 버튼으로 교체했다. 각 포지션마다 독립된 open 상태를 관리한다.
- 이번 변경에는 DB/RLS 수정이 없다.
- 남은 native select: 없음. 디자인 규칙과 전체 일치 완료.

## 2026-05-19 (2)

### P1/P2 기능 정리 — SQL Smoke, Product Canvas, Infinite Scroll

- `scripts/automation/smoke-db-sql.sh`를 추가했다. `SUPABASE_DB_PUSH_URL` (또는 `SUPABASE_DB_URL`)을 읽어 `supabase/tests/club_record_smoke.sql`을 psql로 실행한다. `package.json`에 `db:smoke:sql` 스크립트를 연결했다.
- `docs/01-product-canvas.md`를 클럽 레코드 중심으로 전면 재작성했다. 이벤트 → 슬롯 → 참가자 → 자동 편성 → 경기 → 결과 → 히스토리/월간 카드/랭킹 흐름 전체를 정리했다.
- `club-record-history.tsx`에 무한 스크롤을 도입했다. `match-list.tsx`와 동일한 패턴: `PAGE_SIZE=16`, `IntersectionObserver` (rootMargin 300px), sentinel div, `visibleCountByKey` Map(`dateFilter-opponentFilter-viewMode` 키). 필터나 뷰 모드가 바뀌면 자동으로 처음부터 다시 로드된다.
- 이번 변경에는 DB/RLS 수정이 없다.

## 2026-05-19

### P0/P1 UI/Config 정리

- `packageManager`를 `pnpm@10.26.0`에서 `npm@10.9.2`로 변경해 CI/scripts/docs와 실제 운영 도구를 일치시켰다.
- `window.confirm` 3곳(이벤트 취소, 경기 삭제, 확정 결과 덮어쓰기)과 native `<details>` 경기 메뉴를 shadcn `AlertDialog` + `DropdownMenu`로 전환했다. `AlertDialog`와 `DropdownMenu` 컴포넌트를 신규 추가했다.
- 확정 결과 덮어쓰기의 경우 Modal 내 기존 "운영진 수정은 확정 결과를 덮어씁니다" 안내가 confirm 역할을 대신하므로, 별도 AlertDialog 없이 경고 문구로 대체했다.
- 이번 변경에는 DB/RLS 수정이 없다.
- legacy `/history`, `/leaderboard`는 bottom nav에 이미 없음이 확인됨(bottom-nav.tsx는 club_record 라우트만 포함). URL 직접 접근 시에는 여전히 접근 가능하며, 정책은 문서에만 명시(legacy 경로는 URL 직접 접근 허용, nav에서 미노출).

## 2026-05-18

### CI / Quality Gate 강화

- `eslint-config-next`를 `16.1.6`에서 `^16.2.6`으로 올려 Next.js 버전(`16.2.6`)과 일치시켰다.
- `verify` 스크립트에 `npm run test`를 추가했다. 기존 `lint && build`에서 `test && lint && build`로 변경되어 로컬 검증과 CI가 동일한 게이트를 가진다.
- `.github/workflows/ci.yml`에 `Test` 단계를 추가했다. 이제 PR/push 시 lint, build 외에 vitest 53개 테스트가 CI에서 실행된다.
- `12-project-review.md` P0 항목 중 "CI에 `npm run test` 없음" 리스크가 해소됐다.
- 이번 변경에는 DB/RLS 수정이 없다.
- 미해결 P1: `packageManager`(pnpm)와 실제 운영(npm) 불일치 — npm/pnpm 기준 확정은 별도 판단 필요.

## 2026-05-14

### Project Review

- `docs/12-project-review.md`를 추가해 제품 목적, 현재 IA, 문서 정합성, UI/UX, DB/RLS, 테스트/자동화, risk register, 권장 작업 순서를 PCD 흐름으로 정리했다.
- `docs/README.md`와 `docs/00-map.md`에 총괄 리뷰 문서를 연결해 전체 상태 점검 시 읽기 경로를 추가했다.
- 이번 변경에는 DB/RLS 수정이 없다.

## 2026-05-13

### UI/UX Agent Rules And IA Verification

- 흩어져 있던 디자인 기준을 `docs/design/00-ui-ux-agent-rules.md`로 모아, UI/UX 에이전트가 정보 위계, shadcn/Radix 우선 사용, 새 UI의 native control 금지, IA 브라우저 검증을 먼저 판단하도록 고정했다.
- `design-ui-designer.md`, `design-ux-designer.md`, `docs/design/AGENTS.md`, `.codex/agents/ux.toml`, `.codex/subagent-prompts.md`를 프로젝트 전용 실행 지침으로 정리했다.
- `docs/02-design-system.md`, `docs/README.md`, `docs/00-map.md`에 새 디자인 실행 규칙과 read path를 연결했다.
- cmux browser로 `홈 / 이벤트 / 히스토리 / 클럽 / 새 이벤트` IA를 1차 확인했다.
- 새 이벤트 화면의 native time select가 긴 combobox 문자열로 노출되는 friction을 확인했고, shadcn/Radix `Popover` 기반 picker로 새 이벤트/이벤트 수정 시간 선택부터 교체하는 후속 작업으로 기록했다.
- shadcn/Radix `Popover` primitive를 추가하고 `ClubRecordTimeSelect`를 만들어 새 이벤트/이벤트 수정 시작/종료 시간 선택을 native select에서 교체했다.
- 참가자 관리자, 경기 컨트롤, 일정 생성에 남은 native select는 다음 순차 전환 후보로 남겼다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Dependency Audit Patch

- `npm audit fix`로 Hono, Vite, picomatch, brace-expansion, fast-uri, flatted, express-rate-limit 등 lockfile 패치 가능한 보안 경고를 정리했다.
- Next.js를 `16.1.6`에서 registry 최신 `16.2.6`으로 올려 high severity Next audit 항목을 낮췄다.
- 남은 audit 항목은 `next@16.2.6` 내부 `postcss@8.4.31`에 대한 moderate 경고이며, npm이 제안하는 `npm audit fix --force`는 `next@9.3.3` 다운그레이드를 유도하므로 적용하지 않는다.
- 이번 변경에는 DB/RLS 수정이 없다.

## 2026-05-12

### Club Record History Team Names

- `내 기록` 카드의 `내 팀` 영역이 실제로는 파트너만 표시해 단식에서는 본인 이름이 비고, 복식에서는 본인 없이 파트너만 보이는 문제를 확인했다.
- `get_my_club_record_history`, `get_club_record_member_history` RPC에 `team_names`를 추가해 조회 대상 본인/대상 회원을 첫 항목으로 포함한 팀 전체 이름을 반환하도록 했다.
- 기존 `partner_names` / `opponent_names`는 호환성을 위해 유지하고, UI는 `team_names`를 기준으로 내 팀을 표시하며 첫 이름을 `--player-highlight` 파란 계열 텍스트 색상과 굵기로만 강조한다.
- 카드/리스트 모두 이름 배지와 chip 표현을 제거하고 `내 팀 이름들  스코어  상대 이름들` 매치업 라인으로 통일했다.
- 텍스트 강조 요청을 임의로 배지/칩 컴포넌트로 확장하지 않는 규칙을 디자인 시스템과 히스토리 UI 가이드에 반영했다.
- `supabase/tests/club_record_smoke.sql`에 복식과 단식 모두에서 `team_names`가 정확한 순서로 반환되는지 확인하는 회귀 검증을 추가했다.
- migration `20260512120500_add_club_record_history_team_names.sql`을 메인 DB에 적용하고 `supabase/schema.sql`을 동기화했다.
- cmux browser로 이벤트 생성, 회원 참가자 추가, 자동 편성, `6-4` 결과 입력, 히스토리 카드 반영까지 확인했다. cmux의 React controlled input 한계로 수동 게스트 폼 입력은 DB 보강으로 이어서 검증했다.

### Club Record History Guest Names RPC Fix

- `내 기록` 카드에서 게스트 참가자가 partner/opponent 이름 배열에 누락되어 2:2 복식이 1명 vs 2명처럼 보이는 문제를 확인했다.
- `get_my_club_record_history`, `get_club_record_member_history` RPC를 새 migration으로 재적용해, 경기 선수 이름을 `club_members.nickname`뿐 아니라 `club_record_guest_profiles.display_name`까지 명시적으로 포함하도록 보강했다.
- migration `20260512113000_fix_club_record_history_guest_names.sql`을 메인 DB에 적용하고 `supabase/schema.sql`을 동기화했다.
- `supabase/tests/club_record_smoke.sql`에 내 기록/운영진 타인 기록 RPC가 게스트 표시명을 반환하는지 확인하는 회귀 검증을 추가했다.
- `cmux browser`로 `/clubs/{clubId}/club-record/history`에서 `테스트 게스트`가 상대 목록에 표시되는 것을 확인했다.

### Match Confirmation Home Prompt

- 현재 클럽 홈이 `club_record` 대시보드로 바뀐 뒤 일반 경기의 확인 요청 벨이 예전 히스토리 화면에만 남아 있어, 사용자가 `기록됨/재검토 필요` 후속 액션을 놓칠 수 있는 구조를 확인했다.
- 클럽 홈에 `확인할 경기` 프롬프트 카드를 추가해, 처리해야 할 경기 확인 요청이 있을 때 최대 3개를 바로 상세 화면으로 연결한다.
- 확인 요청이 없거나 로딩/오류 상태일 때는 홈을 어지럽히지 않도록 카드를 숨긴다.
- auth callback과 게스트 초대코드 패널에 남아 있던 독립 로딩 문구를 스피너 단독 표시로 정리했다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Event Visibility And Loading UI

- 홈/이벤트 목록이 현재/미래 이벤트가 없을 때 최신 과거 이벤트를 fallback으로 보여주던 동작을 제거했다.
- 종료 시간이 지난 `club_record` 이벤트와 `completed`/`cancelled`/삭제 이벤트는 홈의 `현재 이벤트`와 이벤트 탭의 목록 후보에서 제외한다.
- 직접 URL로 지난 이벤트 워크스페이스에 진입하면 `지난 이벤트` 배지를 표시하고, 이벤트 수정/취소/자동 편성/참가자 추가/수동 경기 생성은 막는다.
- 지난 이벤트의 경기 결과는 운영진 사후 입력/수정 경로만 남기고, 회원용 결과 입력은 막는다.
- 같은 시간대 가능 인원이 4명 미만인 빈 코트는 수동 경기 생성 select를 숨기고 사유만 표시한다.
- 만료된 클럽 초대코드는 `초대 만료` 배지와 안내를 표시하고 복사/공유를 비활성화하며, owner에게 재발급을 primary CTA로 보여준다.
- 홈/이벤트 empty state에 `새 이벤트 만들기` CTA를 추가하고, 랭킹의 회원 동기화 문구를 `클럽 회원 불러오기`로 통일했다.
- 공통 `LoadingSpinner`는 텍스트 없이 스피너만 표시하도록 바꿨고, 히스토리 무한 스크롤/확인 요청 모달의 로딩 문구도 제거했다.
- 과거 이벤트 노출 방지 로직을 `dashboard-events` 순수 유틸로 분리하고 단위 테스트를 추가했다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Auto Assignment Fill Priority

- 자동 편성이 `같은 페어 반복 금지`와 `같은 사람 조합 최대 2회`를 하드 차단으로 사용해, 참가자가 적은 이벤트에서 뒤 시간대 슬롯을 생성하지 못하던 문제를 수정했다.
- 페어/조합 반복은 차단 조건이 아니라 점수 페널티로 낮춰, 가능한 4명이 있으면 규칙 선호를 일부 포기하더라도 다음 시간대 경기를 계속 생성하도록 했다.
- 같은 시작 시간의 여러 코트에는 기존처럼 같은 참가자를 중복 배정하지 않는다. 따라서 참가자가 4명인 2코트 이벤트는 같은 30분 구간에 1경기만 생성되고, 다음 시간대로 넘어가며 계속 경기를 만든다.
- 이벤트 요약의 `빈 슬롯` 표현을 `편성 가능 슬롯`으로 바꿔, 실제 빈 코트와 4명 편성이 가능한 슬롯을 혼동하지 않게 했다.
- 이번 변경에는 DB/RLS 수정이 없다.

## 2026-05-08

### Club Record Participant And Score UI Revision

- 이벤트 워크스페이스 참가자 영역을 폼 우선 구조에서 `현재 참가자 목록 + 참가자 추가` 액션 구조로 바꿨다.
- `참가자 추가` 다이얼로그 안에서 `클럽 회원 / 게스트` 탭을 제공하고, 클럽 회원은 미참가 회원을 체크해 여러 명을 한 번에 추가하도록 변경했다.
- 게스트 수동 추가는 같은 다이얼로그의 `게스트` 탭으로 옮겨 참가자 추가 동선을 하나로 묶었다.
- 결과 입력/수정 다이얼로그의 스코어 입력을 텍스트 필드에서 팀별 `- / +` 스텝퍼로 바꿔 어느 팀 점수인지 바로 보이게 했다.
- 확정 경기 결과를 운영진이 수정할 때만 저장 전 확인을 요구하고, pending 결과 입력은 바로 저장하는 기준을 유지했다.
- 경기 삭제는 결과 입력 버튼 옆 텍스트 버튼에서 더보기 메뉴 안으로 옮겨 주요 액션과 destructive 액션을 분리했다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Operation Flow Verification

- 실제 테스트 클럽 UUID 경로에서 이벤트 목록 진입, 새 이벤트 생성, 워크스페이스 이동, 회원 3명 참가자 추가, 수동 게스트 1명 추가, 첫 슬롯 수동 복식 경기 생성, `6-4` 결과 저장을 cmux browser로 검증했다.
- 결과 저장 후 워크스페이스에서 해당 슬롯이 `완료` / `확정` / `결과: 6-4`로 표시되는 것을 확인했다.
- 이벤트/워크스페이스 로딩 중 Supabase auth token lock warning이 재발하지 않도록 `getCurrentUser()`와 `ensureSessionUser()`의 동시 호출을 공통 인증 서비스에서 in-flight promise로 coalesce했다.
- 공통 `Modal`이 Radix `DialogDescription`을 항상 연결하도록 보강해 결과 입력 다이얼로그의 접근성 콘솔 경고를 제거했다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Route Invalid ID Error Handling

- `/clubs/test-club/club-record/ranking`처럼 실제 UUID가 아닌 클럽 주소로 직접 진입하면 Supabase UUID cast 에러가 발생하는 것을 확인했다.
- 클럽 선택 화면에서 들어갈 때는 실제 `clubs.id` UUID를 사용하므로 정상 진입한다.
- `/clubs/[clubId]` layout에서 `clubId`가 UUID 형식이 아니면 즉시 `/`로 redirect하도록 해, 잘못된 값이 AppShell/bottom nav/service/Supabase query까지 전파되지 않게 했다.
- club/club_record 에러 매핑에서 plain object 형태의 PostgREST 에러 메시지를 보존하고, invalid UUID는 `클럽 주소가 올바르지 않습니다. 내 클럽 목록에서 다시 진입해주세요.`로 안내하도록 했다.
- 랭킹 화면에서 access 조회와 ranking 조회가 동시에 `requireUser()`를 호출해 Supabase auth lock 경합이 날 수 있어, access 확인 후 ranking을 조회하도록 순서를 조정했다.
- cmux browser로 `/clubs/test-club/club-record/ranking` 직접 진입 시 클럽 목록(`/`)으로 돌아가도록 확인했다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Auth Request Sequencing

- 랭킹 화면에서 발견한 Supabase auth lock 경합이 대시보드/워크스페이스/클럽 상세 초기 로딩에서도 재발할 수 있어 초기 데이터 조회 순서를 조정했다.
- `getClubRecordDashboardData`, `getClubRecordEventWorkspace`, `getEventAssignmentBoard`, `useClubDetail`의 초기 병렬 조회를 순차 조회로 바꿔 같은 탭에서 `requireUser()`가 동시에 여러 번 실행되는 상황을 줄였다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Member Ranking Management

- 홈 대시보드의 `운영 랭킹` 진입명을 `클럽 회원 랭킹`으로 바꾸고, `/clubs/{clubId}/club` 멤버 섹션 우측에 운영진용 `랭킹 관리` 진입을 추가했다.
- 랭킹 화면에서 클럽 회원이 보이지 않던 원인은 `club_members`를 `club_record_members`로 초기 등록하는 동기화 경로가 없었기 때문으로 확인했다.
- `sync_club_record_members(club_id)` RPC를 추가해 운영진/관리자가 활성 `owner/manager/member`를 랭킹에 append하고, 중복 호출은 0건으로 끝나며, 그룹은 기존 비율대로 재계산되게 했다.
- 새 sync RPC의 execute 권한은 `authenticated`/`service_role`로 제한하고 `anon`/`public` grant를 제거했다.
- ranking service/hook/view에 회원 랭킹 동기화 액션을 연결했고, D&D는 모바일 스크롤/저장 충돌 리스크 때문에 제외하고 위/아래 버튼의 즉시 저장 방식을 유지했다.
- `supabase/tests/club_record_smoke.sql`에 sync RPC idempotency, guest/비활성 제외, 그룹 재계산, non-admin 차단 검증을 추가했다.
- cmux browser로 실제 테스트 클럽 UUID 경로의 랭킹 동기화 버튼을 실행해 활성 회원 3명이 랭킹에 추가되고 게스트가 제외되는 것을 확인했다.

### Club Record Event List Safe Landing

- `/clubs/[clubId]/club-record/events`를 추가해 멤버/게스트가 먼저 current/upcoming event 목록을 보는 안전한 진입점을 만들었다.
- `ClubRecordEventListView`는 current/upcoming events를 보여주고, `canCreateEvent`가 true일 때만 `새 이벤트` 버튼을 노출한다.
- 하단 네비게이션의 `이벤트`는 `/clubs/{clubId}/club-record/events`를 기본 진입점으로 사용하고, `/clubs/{clubId}/club-record/new`와 이벤트 상세/워크스페이스 라우트까지 active 범위로 묶는다.
- `홈`은 `/clubs/{clubId}`, `/clubs/{clubId}/club-record`, `/clubs/{clubId}/club-record/monthly`, `/clubs/{clubId}/club-record/ranking`을 active 범위로 둔다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record IA Option 1 Navigation Split

- `/clubs/[clubId]`를 `ClubRecordDashboardView`의 메인 클럽 홈으로 연결해 club_record 진입점을 클럽 상세에서 분리했다.
- `/clubs/[clubId]/club`를 기존 `ClubDetailView` 기반의 클럽 정보/초대/일정/멤버 관리 화면으로 새로 열고, 클럽 운영용 정보와 경기 운영 화면의 진입점을 나눴다.
- 하단 네비게이션은 `홈 / 이벤트 / 히스토리 / 클럽`으로 정리했다.
  - `홈` -> `/clubs/{clubId}`
  - `이벤트` -> `/clubs/{clubId}/club-record/events`
  - `히스토리` -> `/clubs/{clubId}/club-record/history`
  - `클럽` -> `/clubs/{clubId}/club`
- `/clubs/[clubId]/club-record`는 기존 대시보드 별칭으로 유지하고, `/matches/new`, `/history`, `/leaderboard`는 기존 상태로 남겨 두되 더 이상 기본 하단 탭으로 노출하지 않는다.
- `ClubDetailView`에서 옛 일반 경기 CTA 그리드를 제거해 새 `클럽` 탭의 범위를 클럽 정보/초대/일정/멤버 관리로 좁혔다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Monthly Public Card Detail Screen

- `src/app/clubs/[clubId]/club-record/monthly/page.tsx`를 추가해 월간 공개 카드 상세 화면을 연결했다.
- `src/features/club-record/components/club-record-monthly-card.tsx`와 `src/features/club-record/hooks/use-club-record-monthly-card.ts`를 추가해 이전/다음 달 이동, 새로고침, loading/error/empty 상태, 모바일 카드 리스트와 데스크톱 테이블을 제공했다.
- 상세 화면은 읽기 전용이며 기존 `getMonthlyPublicCard` RPC/service를 재사용한다.
- 대시보드의 월간 공개 카드 미리보기는 `/clubs/{clubId}/club-record/monthly`로 이동하도록 연결했다.
- `winRate`는 기존 contract대로 `0..100` 범위를 그대로 사용하고, 화면에서 추가 `* 100` 보정은 하지 않는다.
- 이번 변경에는 DB/RLS 수정이 없다.

### Club Record Result Input UX

- `ClubRecordMatchControls`의 결과 입력/수정 UX를 인라인 폼에서 다이얼로그 진입으로 바꿔 회원 입력과 운영진 수정 경로를 구분했다.
- 회원은 본인이 참가한 `pending_result` 경기에서만 `결과 입력`을 열 수 있고, 입력 불가 상태는 확정/취소/비참가/권한 없음 안내로 드러낸다.
- 운영진/관리자는 `결과 수정` 액션으로 기존 결과를 덮어쓰는 경로를 사용하며, 다이얼로그 안에서 확정 결과 수정 안내를 표시한다.
- 스코어 입력은 `6-4` 형식의 클라이언트 즉시 검증, 숫자 키패드 힌트, 저장 버튼 비활성 조건을 추가했다.
- 슬롯/경기 상태 배지는 raw enum 대신 `예정`, `준비`, `완료`, `결과 대기`, `확정`, `취소` 같은 한국어 라벨로 표시한다.
- DB/RLS 변경은 없고, 기존 `submit_club_record_match_result` / `update_club_record_match_result` RPC와 smoke 경계를 유지한다.

### Club Record Self History Screen

- `src/app/clubs/[clubId]/club-record/history/page.tsx`와 `src/features/club-record/components/club-record-history.tsx`를 추가해 회원 본인 기록 전용 화면을 연결했다.
- `useClubRecordHistory(clubId)`와 `get_my_club_record_history` RPC를 재사용해 카드/리스트 보기, 날짜 필터, 상대 이름 필터, empty/loading/error/refresh 상태, 이벤트 링크를 제공한다.
- 대시보드에서는 `canViewOwnHistory`가 있는 멤버에게 `/clubs/{clubId}/club-record/history`를 `내 기록`으로 노출하도록 연결했다.
- 이번 변경은 기존 RPC/service 경계를 재사용한 라우트 및 UX 추가였고, 신규 migration이나 RLS 변경은 없다.
- `npm run lint`, `npm run build`, club-record util tests가 통과했다.

### Club Record Event Edit UI

- `src/features/club-record/components/club-record-event-edit-dialog.tsx`의 `ClubRecordEventEditDialog`를 연결해 이벤트 워크스페이스 요약 카드에서 운영진/관리자용 `이벤트 수정` 진입을 추가했다.
- 수정 다이얼로그는 기존 `updateClubRecordEvent` 서비스 경계를 재사용해 이름, 날짜, 시작/종료 시간, 코트 수를 저장한다.
- 날짜/시간/코트 수가 바뀌면 참가자와 편성이 초기화되는 현재 서비스 동작을 UI에서 경고하고, 체크 확인 후 저장하도록 했다.
- 확정 경기가 있는 이벤트의 일정/코트 변경은 기존 서비스 가드와 DB trigger 보호 범위를 유지하며, 이번 변경에는 신규 migration/RLS 변경이 없다.
- `npm run lint`, `npm run build`가 통과했다.

### Club Record Guest Invite Join Route

- `/club-record/join/[inviteCode]` guest join route와 `ClubRecordGuestJoinView`를 추가해 club_record 초대 참가 진입점을 분리했다.
- 새 join view는 Kakao, email, anonymous guest session entry를 먼저 허용한 뒤 기존 `verifyGuestInviteCode` / `joinEventAsGuestByInviteCode` 서비스 경로로 초대 검증과 참가 처리를 이어간다.
- `ClubRecordGuestInvitePanel`은 `/club-record/join/{code}` 링크를 복사하도록 맞췄다.
- 이번 변경은 기존 RPC/service 경계를 재사용한 라우트/UX 추가였고, 신규 migration이나 RLS 변경은 없다.

## 2026-05-07

### Club Record RF-005 Smoke Coverage

- `supabase/tests/club_record_smoke.sql`에 deleted event와 cancelled event의 confirmed match fixture를 추가해 월간 공개 카드가 숨김/취소 이벤트 결과를 집계하지 않는지 검증했다.
- smoke fixture는 정상 이벤트 참가자/경기 생성 후 이벤트를 `is_deleted=true` 또는 `status='cancelled'`로 전환하고, 해당 confirmed match가 월간 카드 owner row에 영향을 주지 않는지 확인한다.
- 월간 공개 카드 검증을 `win_rate` scale만 보던 방식에서 `2승 0패 1무`와 `win_rate ~= 67`을 함께 확인하는 방식으로 확장했다.
- Docker Postgres `psql` smoke가 `ROLLBACK`으로 통과했고, RF-005는 smoke fixture gap에서 resolved 상태로 정리했다.

### Club Record Production Apply / Smoke

- 사용자가 `nomcsuizsztyhxkehila`를 1인 개발용 local/prod 공용 메인 DB로 확인하고 운영 DB 적용을 명시 승인해 `club_record` migration을 적용했다.
- 본 migration 4개(`20260506120000`~`20260506123000`)를 적용하고 `supabase/schema.sql`을 remote schema 기준으로 동기화했다.
- smoke 중 발견된 실제 DB/RPC 이슈를 새 migration 3개로 보정했다.
  - `20260507094500_fix_club_record_ranking_move.sql`: `move_club_record_ranking`의 비지연 unique 충돌을 임시 오프셋 방식으로 보정
  - `20260507095500_fix_club_record_guest_join_conflicts.sql`: 게스트 초대 join RPC의 `on conflict` column ambiguity를 constraint 기반으로 보정
  - `20260507100500_fix_club_record_result_update_conflict.sql`: 운영진 결과 수정 RPC의 `on conflict` column ambiguity를 constraint 기반으로 보정
- `supabase/tests/club_record_smoke.sql` fixture를 운영 DB 제약에 맞게 보정했다.
  - smoke fixture 클럽명을 `clubs_name_length_check` 안에 들어오도록 단축
  - `SET ROLE authenticated` 이후 temp table을 읽을 수 있게 temp table grant 추가
  - 실제 참가자인 late observer와 비참가 overview 차단 검증 대상을 분리
- Docker Postgres `psql` 클라이언트로 smoke SQL을 실행했고 confirmed 삭제 방지, slot cascade 삭제 방지, linked participant 삭제 방지, event 취소/삭제 방지, ranking move, cross-club participant 차단, guest invite join, late arrival guard, inactive member 차단, non-participant overview 차단, participant overview redaction, guest result 차단, member result submit, manager result update, monthly `win_rate` scale 검증이 모두 통과했다.
- smoke는 `ROLLBACK`으로 종료했으며, 최종 `npm run db:push:dry`는 `Remote database is up to date.`를 반환했다.
- 후속 검증으로 explicit `any` scan, `npm run env:check`, `npm run db:smoke`, `npm run lint`, club-record util tests(`7 files / 18 tests`), `npm run build`가 통과했다.
- archived/cancelled event monthly stats exclusion은 같은 날 후속 smoke fixture로 보강했다.

### Club Record DB Target Blocker

- 이 항목은 같은 날 후속 승인으로 해소됐고, 최종 적용 결과는 위 `Club Record Production Apply / Smoke`에 기록했다.
- `SUPABASE_DB_PUSH_URL` resolves to remote Supabase pooler host `aws-1-ap-northeast-1.pooler.supabase.com` with user `postgres.nomcsuizsztyhxkehila`; disposable local/staging DB status is not confirmed.
- Because the target DB could not be proven disposable, `npm run db:push` and `psql "$SUPABASE_DB_PUSH_URL" -f supabase/tests/club_record_smoke.sql` were not run.
- Pre-apply checks passed: explicit `any` scan only hit the eslint rule line, `npm run lint`, club-record util tests (`7 files / 18 tests`), `npm run build`, and `npm run db:push:dry` with 4 pending `club_record` migrations.
- 당시 다음 명령은 안전한 대상 또는 명시 승인이 확인된 뒤에만 `npm run db:push`, smoke SQL 순서로 실행하는 것이었다.

### Documentation Map / Policy Alignment

- `docs/00-map.md`를 추가해 작업 유형별 읽기 경로와 문서 그룹을 명확히 정리했다.
- `docs/README.md`에 빠른 읽기 경로, `11-auth-onboarding-design.md`, 디자인 문서 인덱스를 추가해 문서 진입점을 보강했다.
- `docs/design/README.md`를 추가해 `club_record` 디자인 방향, 토큰, primitive 문서의 읽기 순서를 고정했다.
- `docs/09-keep-rules.md`의 DB 반영 정책을 현재 운영 기준에 맞춰 `db:push:dry` 선확인 후 CLI 반영 기본으로 정정했다.
- `AGENTS.md`와 `docs/03-architecture.md`에 `schedules`, `club-record` 디렉터리 책임과 `CLAUDE.md`의 보조 문서 성격을 명시했다.
- Vercel/GitHub/Supabase CLI와 MCP 연결 상태를 실제 로컬 명령으로 확인하고, Vercel/Supabase는 MCP 미등록 상태에서 CLI 중심으로 운영한다는 기준을 `AGENTS.md`와 `docs/05-automation.md`에 기록했다.
- 확인 결과 Vercel CLI는 linked project/env 조회 가능, Supabase CLI는 auth/project list와 DB URL 기반 smoke/dry-run 가능, GitHub CLI는 미설치이며 GitHub MCP와 `git` 원격 조회를 사용하는 상태로 정리했다.
- Supabase migration list와 dry-run 결과를 반영해 `Remote database is up to date` 기대값을 폐기하고, 현재 기준 4개 `club_record` migration pending 상태를 `AGENTS.md`와 `docs/05-automation.md`에 명시했다.

### Club Record Migration Pre-Apply Guard Patch

- `club_record` migration 적용 전 review findings 중 ranking move unique 충돌, 초대 게스트 참가 RLS/RPC 경로, participant club mismatch, 월간 카드 승률 scale을 실제 패치로 반영
- `move_club_record_ranking`가 임시 ranking position을 거쳐 이동하도록 바꿔 `unique (club_id, ranking_position)` transient 충돌을 피하게 했다
- 초대 게스트 참가를 `join_club_record_event_guest_by_invite_code` security definer RPC로 묶고, 서비스가 direct insert 대신 RPC를 호출하도록 변경했다
- `validate_club_record_event_participant` trigger로 event club과 member/guest club 일치 및 active member 조건을 DB 경계에서 검증하도록 추가했다
- 월간 공개 카드 `win_rate` contract를 `0..100` percentage scale로 문서화하고 UI 표시에서 추가 `* 100`을 제거했다
- `supabase/tests/club_record_smoke.sql`에 ranking move, cross-club participant insert 차단, 초대 게스트 참가 RPC, 월간 공개 카드 scale 회귀 검사를 추가했다
- 검증 결과 `npm run lint`, club-record util tests, `npm run build`, `npm run db:push:dry`가 통과했고 실제 DB apply는 하지 않았다

### Club Record Next Handoff Refresh

- `docs/club-record/07-handoff.md`에 현재 handoff snapshot을 추가해 실제 DB apply 미실행, 4개 migration pending, smoke 미실행, guard patch 반영 완료 상태를 명확히 기록
- 다음 작업 우선순위를 `disposable local/staging DB apply + club_record smoke 실행`으로 재정렬했다
- `Next Agent Prompt`를 다음 작업자가 그대로 복사해 쓸 수 있도록 local/staging apply, smoke 실행, 운영 DB apply 금지, 최종 응답 형식 중심으로 갱신했다
- 운영 DB 반영은 여전히 명시 승인 전 금지이며, 다음 단계는 로컬/스테이징에서 `npm run db:push`와 `psql "$SUPABASE_DB_PUSH_URL" -f supabase/tests/club_record_smoke.sql`을 실행하는 것이다

### Club Record Review Findings

- `club_record` 리뷰에서 발견된 P1/P2 이슈를 `docs/club-record/08-review-findings.md`에 별도 추적 문서로 남김
- 랭킹 이동 unique 충돌, 게스트 초대 참가 RLS/RPC 경로, 참가자 club mismatch, 월간 카드 승률 scale, archived event 통계 제외 여부를 각각 재검토 가능한 항목으로 정리
- 다음 작업자가 수정 여부를 판단할 수 있도록 각 항목에 확인할 파일/함수, 예상 수정 방향, 완료 판정 기준, 권장 검증 명령을 추가
- `docs/club-record/README.md`, `06-checklist.md`, `07-handoff.md`, `docs/README.md`에서 새 리뷰 문서를 작업 진입 경로와 적용 전 체크리스트에 연결

### Club Record SQL Consistency Patch

- `club_record` migration 초안의 RLS/RPC 정합성을 재검토하고, 비활성 멤버가 과거 참가 row만으로 이벤트/경기 조회나 결과 입력 권한을 얻지 못하도록 helper/policy 조건에 `is_active=true`를 보강
- 취소/삭제된 이벤트와 취소된 경기는 멤버/게스트용 direct select 및 overview/history/monthly RPC 응답에서 제외하고, 이벤트 슬롯 overview는 운영진/관리자 또는 해당 이벤트 참가자에게만 노출되도록 축소
- `confirmed` 경기가 있는 이벤트는 서비스와 SQL trigger 양쪽에서 소프트 삭제/취소를 차단하도록 보강해 확정 결과/통계가 숨겨지는 경로를 막음
- 자동/수동 경기 생성 RPC가 참가자의 `arrival_time`보다 이른 슬롯 배정을 직접 차단하도록 보강
- 참가자 RPC에서 랭킹 위치는 운영진/관리자에게만 내려주고, 내부 member/guest 식별자는 운영진/관리자 또는 본인 식별에 필요한 경우로 제한
- migration 적용 후 확인할 수 있도록 `supabase/tests/club_record_smoke.sql`을 추가하고, confirmed 삭제 방지/RLS-RPC 권한/늦참 배정/결과 입력 경로를 `rollback` 기반 smoke 시나리오로 고정
- 다음 작업자가 바로 이어받을 수 있도록 `docs/club-record/07-handoff.md`에 migration 적용 전 최종 검증 전용 프롬프트, 금지 사항, 검증 명령, 최종 응답 형식을 추가

### Club Record Handoff / Data Guard

- `docs/club-record/07-handoff.md`를 다음 작업자 진입 문서로 추가하고, `CLAUDE.md` 선독, `any` 금지, 최근 검증 명령, migration draft, 남은 작업 분할 기준을 정리
- `docs/README.md`에 `club_record.md`와 `docs/club-record/README.md`를 연결해 상위 문서 목록에서도 club_record 설계 문서로 바로 진입할 수 있게 보강
- 이벤트 시간/코트 변경 시 슬롯/참가자 초기화가 confirmed 경기 데이터를 지울 수 있는 리스크를 막기 위해, 서비스 계층에서 confirmed 경기 존재 시 일정 변경을 차단하도록 보강
- migration 초안에 confirmed match 삭제 방지 트리거와 연결 경기 참가자의 direct delete 방지 트리거를 추가해, RPC 외 경로에서도 확정 경기와 선수 구성이 훼손되지 않도록 보수적으로 조정

### Club Record Minimum Product Flow

- `club_record` 최소 제품 흐름에 운영진 입력 화면을 추가했다. 새 이벤트 생성 라우트 `src/app/clubs/[clubId]/club-record/new/page.tsx`와 `ClubRecordEventFormView`를 연결해 날짜/시작 시간/종료 시간/코트 수로 바로 슬롯 생성까지 이어지도록 했다.
- 이벤트 워크스페이스에 `ClubRecordParticipantManager`, `ClubRecordGuestInvitePanel`을 추가했다. 운영진은 같은 화면에서 회원 참가자 추가/삭제, 수동 게스트 추가, 이벤트별 게스트 초대코드 생성/재발급/비활성화를 처리할 수 있다.
- 참가자 `arrival_time`은 스키마의 `timestamptz`에 맞춰 이벤트 날짜 기반 ISO timestamp로 저장되도록 수정했다. UI에서는 이벤트 시간 범위 안의 30분 단위 옵션만 노출한다.
- 수동 게스트 추가를 허용하기 위해 `club_record_guest_profiles.guest_user_id`를 nullable로 조정했다. 카카오 기반 게스트 초대 흐름은 그대로 유지하고, 운영진 현장 추가도 함께 수용한다.
- `club_record` 대시보드와 이벤트 워크스페이스에 `새 이벤트` 진입을 추가해 운영진이 기존 클럽 상세를 거치지 않고 바로 이어서 작업할 수 있게 했다.
- 이벤트 워크스페이스 슬롯 카드에 `ClubRecordMatchControls`를 연결했다. 운영진은 빈 슬롯에서 수동 경기 4인을 지정할 수 있고, pending/confirmed 경기에는 권한에 따라 스코어 결과를 입력하거나 수정할 수 있다.
- 수동 경기 삭제는 기존 RPC 경계를 그대로 사용한다. 확정 경기 삭제는 DB 함수에서 차단되고, pending/cancelled 경기만 슬롯 해제와 함께 삭제된다.
- 빌드 중 드러난 `getMonthlyPublicCard` RPC 응답의 암시적 미지정 타입을 명시 타입으로 보강했다.
- `club_record` access context에 현재 사용자의 `clubMemberId`를 포함했다. 회원은 본인이 실제 참가한 경기에서만 결과 입력 컨트롤을 보고, 운영진/관리자는 전체 결과 수정 권한을 유지한다.
- 이벤트 워크스페이스에 이벤트 취소 액션을 추가했다. 취소는 hard delete가 아니라 기존 `archiveClubRecordEvent` 소프트 삭제 경계를 사용하고, 처리 후 club record 홈으로 이동한다.

## 2026-05-06

### Club Record Domain Design

- `docs/club_record.md`를 새로 도입해 클럽 운영용 데일리 매치 시스템의 확정 규칙을 별도 문서로 정리
- 기존 `matches`/`match_schedules`를 재사용하지 않고, `club record`를 새 하위 도메인으로 분리한다는 원칙을 고정
- 역할 체계(`관리자 > 운영진 > 회원 > 게스트`), 랭킹 비공개 정책, 데일리 매치 운영 규칙, 게스트 초대코드, 늦참 반영 규칙, 결과 입력/취소 정책을 문서화
- 후속 구현 전 단계로 새 엔티티 목록, 관계 구조, 상태 모델, 권한 정책, 자동 편성 로직 v1, 통계/히스토리 범위, 화면 흐름, 구현 순서를 `club_record.md`에 구체화
- 게스트 결과 입력 비허용, 본인 히스토리 비공개 범위, 운영진 전체 히스토리 조회, 클럽 월간 승/패 카드 공개 정책을 추가 반영
- 스코어 자유 입력/필수값, 스코어 기반 승패무 자동 계산, 이벤트 종료+24시간 취소 규칙, 취소 경기 운영진 전용 노출, 월간 카드 정렬 기준을 추가 반영
- 관리자 1명 정책, 그룹 `A/B/C` 비율 기본값(20/30/50), 게스트 그룹 지정, 소프트 삭제/참석자 삭제/자동 경기 삭제 정책을 추가 반영
- club record 전용 enum/테이블/관계/인덱스/마이그레이션 순서를 포함한 DB 스키마 초안을 `docs/club_record.md`에 추가
- 역할별 접근 매트릭스, 서비스 계층 책임, RPC 후보, 자동 취소 배치 작업, RLS 초안 원칙을 `docs/club_record.md`에 추가
- 실제 migration 작성 전 단계로 enum/table/index/trigger/seed/validation/migration split까지 포함한 SQL migration draft를 `docs/club_record.md`에 추가
- 테이블별 읽기/쓰기 권한, helper function 후보, view/RPC 노출 전략, 민감 필드 규칙, RLS 위험 포인트를 `docs/club_record.md`에 추가
- `docs/club_record.md`를 상위 진입 문서로 축소하고, `docs/club-record/` 아래에 `README`, `Rules`, `Domain`, `Schema`, `Access` 문서로 분리해 이후 구현 시 필요한 컨텍스트만 선택적으로 읽을 수 있게 재구성
- club record migration 초안에 `guest_invites`/`event_slots`의 `updated_at` 추적을 보강하고, 결과 입력자가 실제 해당 경기 참가자인지 검증하는 helper function을 추가
- 참가자 목록과 선수 구성은 direct table select 대신 RPC/DTO로 제한하는 방향으로 access 설계를 보수적으로 조정
- `docs/club-record/05-implementation.md`를 추가해 실제 구현 순서, 추천 feature 구조, 서비스/훅/라우트 후보 파일을 정리
- `docs/club-record/06-checklist.md`를 추가해 migration 전후 점검 항목, 권한 검증 포인트, 구현 단계별 체크리스트를 정리
- `src/features/club-record/` 아래에 types / services / hooks 스캐폴딩을 추가해 이후 구현 시 문서 구조에서 코드 구조로 바로 이어질 수 있게 정리
- 스캐폴딩 서비스 함수는 `Not implemented` 예외를 던지는 형태로 고정하고, 프로젝트 전체 `npm run lint`가 통과하도록 미사용 인자 경고를 정리
- `club-record`의 `settings`, `ranking`, `events`, `participants`, `slots`, `results`, `history` 서비스 일부를 실제 Supabase 조회/RPC 호출 형태로 연결
- 스코어 문자열 파싱 유틸(`utils/score.ts`)과 단위 테스트(`utils/score.test.ts`)를 추가하고, `npm run lint`, `npm run test -- src/features/club-record/utils/score.test.ts` 통과를 확인
- 게스트 프로필/초대코드 서비스와 수동 경기 생성/삭제 서비스를 실제 insert/update/delete 흐름으로 연결
- 본인 히스토리/운영진 타인 히스토리 RPC 초안을 migration에 추가하고, `services/history.ts`, `hooks/use-club-record-history.ts`를 이에 맞춰 확장
- `club record` 이벤트 생성 시 30분 단위 슬롯을 자동 생성하도록 `utils/slots.ts`와 `services/events.ts`를 보강
- 이벤트 시간/코트 수가 바뀌면 기존 슬롯/경기/참가자를 초기화하고 상태를 `draft`로 되돌리는 일정 재설정 규칙을 서비스 계층에 반영
- 수동 경기 생성 시 4인 중복 방지, 팀 인원/포지션 검증, 슬롯 잠금 여부 확인, 현재 이벤트 참가자 여부 확인을 추가해 잘못된 조합 저장을 사전에 차단
- 슬롯 생성 유틸 단위 테스트(`utils/slots.test.ts`)를 추가해 30분 단위 분할 규칙과 예외 케이스를 검증
- 게스트 초대코드 RPC 초안을 실제 서비스에서 사용하도록 연결하고, `코드 검증 -> 게스트 프로필 upsert -> 이벤트 참가 등록` 흐름을 `services/guests.ts`에 추가
- 참가자 목록 조회를 direct table join 대신 `get_club_record_event_participants` RPC/DTO 기준으로 전환하고, 그룹/랭킹 메타데이터를 함께 내려주는 방향으로 정리
- 슬롯 조회를 `get_club_record_event_slots_overview` RPC/DTO 기준으로 전환하고, 코트/시간/경기/선수/결과를 한 번에 조립할 수 있는 overview 타입을 추가
- 자동편성 구현 전에 필요한 기초 계산을 `utils/assignment-pool.ts`로 분리해, 참가자별 경기 수/같은 날 페어 이력/슬롯별 참여 가능 인원 계산을 순수 함수로 먼저 고정
- 자동편성 v1 순수 계획 유틸(`utils/auto-assignment.ts`)을 추가해 경기 수 균등, 랭킹/그룹 근접도, 동일 페어 재사용 금지, 늦참 반영 규칙을 테스트 가능한 형태로 먼저 구현
- 사용자 정정에 맞춰 자동편성 규칙을 `인당 최대 2경기`에서 제거하고, `빈 슬롯은 같은 사람을 재사용해서 최대한 채우되 같은 날 같은 사람과 같은 매치에 함께 엮이는 횟수는 최대 2회` 기준으로 문서와 유틸 로직을 수정
- `attendance_count`/`match_count` 기준을 확정하고, 삭제되지 않은 이벤트 참가 등록 및 `confirmed` 경기(자동/수동 포함)를 기준으로 회원 집계를 재계산하는 SQL helper/trigger 초안을 추가
- 참가자 삭제 규칙을 확정하고, `confirmed` 경기 연결 시 삭제 차단 / `pending_result` 경기만 자동 삭제 + 슬롯 해제 후 참가자 삭제하는 RPC 초안을 추가
- 같은 시간대 다중 코트 중복 배정 리스크를 발견해 snapshot에 시간대별 점유 상태를 추가하고, 슬롯별 available participant 계산 및 assignment board 유틸을 보강
- assignment board를 서비스/훅 레벨로 끌어올려 이후 운영 화면에서 슬롯 목록과 함께 `openSlotIds`, `unslottedParticipantIds`, 슬롯별 available participant 계산을 직접 사용할 수 있게 정리
- assignment board에 시간대 그룹(`timeGroups`)을 추가해, 같은 시작시간 기준으로 빈 슬롯/점유 인원/배정 가능 인원을 한 번에 계산할 수 있게 확장
- 자동 편성 적용 단계를 `apply_club_record_auto_assignments` RPC로 묶어, 기존 auto 경기 제거/슬롯 해제/신규 auto 경기 생성/선수 연결/슬롯 잠금을 한 트랜잭션 경계 안에서 처리하도록 정리
- 수동 경기 생성/삭제도 각각 `create_club_record_manual_match`, `delete_club_record_match` RPC로 옮겨 슬롯 잠금/해제와 경기 상태 검증을 DB 경계에서 일관되게 처리하도록 정리
- 이벤트/슬롯/경기 상태가 분리돼 떠다니지 않도록 `refresh_club_record_progress_for_event` 계열 helper/trigger 초안을 추가하고, 참가자/경기 변경 시 상태를 자동 동기화하는 방향으로 정리
- 재편성 필요 경고를 UI 계산에만 맡기지 않도록 `assignment_dirty`, `last_assignment_run_at` 필드와 dirty helper/trigger 방향을 추가해 참가자/수동편성 변경 후 이벤트가 스스로 재편성 필요 상태를 기억하게 정리
- `24시간` 미입력 취소 후에도 운영진이 결과를 다시 입력할 수 있어야 한다는 규칙에 맞춰, 결과 row의 participant 입력자를 nullable로 완화하고 운영진 결과 수정 RPC를 upsert 기반으로 바꿔 취소 경기 사후 확정까지 수용하도록 정리
- 운영 화면이 이벤트/참가자/편성 보드를 제각각 읽다가 서로 다른 시점의 데이터를 섞지 않도록 workspace 타입/서비스/훅을 추가하고, `assignmentDirty`, `lastAssignmentRunAt`, confirmed auto match 여부, open slot/미배정 인원 요약을 한 DTO로 묶는 조립 계층을 도입
- `security definer` RPC를 서비스 로직만 믿지 않도록 보강해, 자동/수동 경기 생성 시 슬롯 소속/잠금 상태/이벤트 참가자 여부/동시간대 중복 출전 여부를 DB에서도 직접 검증하게 정리
- `cancel_expired_club_record_matches` RPC를 직접 쓰지 않도록 maintenance service 래퍼를 추가해, 이후 배치/관리자 재처리 진입점을 서비스 계층에서 일관되게 잡을 수 있게 정리
- `owner/manager/member/guest` 문자열 비교가 club record 페이지/액션 전반에 흩어지지 않도록 access type/util/service/hook을 추가하고, 관리자/운영진/회원/게스트 capability를 한 곳에서 계산하도록 정리
- 클럽 진입 첫 화면 데이터를 위해 access/event list/monthly public card를 한 번에 조립하는 dashboard type/service/hook을 추가하고, 현재 진행 이벤트 선택과 upcoming event 축약 규칙을 서비스 계층으로 올림
- ranking/settings/history 서비스 진입에서 capability를 먼저 확인하도록 보강해, RLS 에러에만 의존하지 않고 운영진 전용/회원 전용 접근 오류를 더 일찍, 더 명확한 메시지로 반환하도록 정리
- `getdesign.md`와 Spotify 레퍼런스를 비교한 뒤, `club_record`는 다크 음악앱보다 `white + green tennis ops dashboard`에 맞다고 판단하고 전용 디자인 방향 문서를 `docs/design/club-record-design-direction.md`로 분리
- `club_record` UI를 바로 바꾸기 전에 사용성 우선 원칙을 고정하기 위해 전용 토큰 문서와 primitive 정리 계획 문서를 추가하고, Button/Input/Card/Badge/StatusBox/Dialog/AppBar/BottomNav를 순차적으로 정리하는 migration 순서를 문서화
- `club_record` 디자인 방향은 기존 제품을 통째로 버리지 않고, 현재 UI에서 사용성이 좋은 모바일 shell / form / card 구조를 유지한 채 Airtable/Vercel/Spotify 일부를 선택적으로 섞는 merge 전략으로 정리
- 공통 primitive 변경 전에 Button/Card/Input/Badge/StatusBox/Dialog/AppBar/BottomNav 각각에 대해 유지할 것, 변경할 것, 필요한 variant, migration 순서를 `club-record-primitive-spec.md`로 고정
- 디자인 polish보다 제품 동작을 우선하기 위해 `club_record` 최소 기능 화면을 실제 라우트에 연결하고, 대시보드/이벤트 워크스페이스/운영 랭킹 뷰와 클럽 홈 진입 CTA를 추가해 데이터/권한/운영 액션 흐름을 실제 앱 안에서 검증 가능한 상태로 올림

## 2026-04-02

### Remote Schema Sync

- `supabase migration repair` 이후 remote migration history와 실제 schema 상태를 다시 점검
- remote dump 기준으로 `supabase/schema.sql`이 최신 운영 스키마와 드리프트 상태임을 확인
- `scripts/automation/db-sync-schema.sh`와 동일한 dump 절차로 `supabase/schema.sql`을 remote 기준으로 다시 동기화
- 확인 결과 `club_member_role.guest`, `club_members.is_active/left_at`, `join_club_by_invite_as_guest`, 최신 `create_match_schedule(... p_ends_at, p_include_host ...)` 등 최근 운영 구조가 로컬 schema 파일에도 반영됨

### User Profiles Migration Apply

- pending 상태이던 `20260402120000_add_user_profiles.sql`을 remote DB 반영 대상으로 확정
- 새 테이블 `user_profiles`는 기존 기능을 깨지 않는 additive 스키마로 판단하고 먼저 반영
- 아키텍처 문서에는 `user_profiles`와 `/onboarding/profile`를 현재 구조로 기록하되, `profile_completed` 기반 전면 권한 강제는 아직 후속 단계라고 명시
- 다른 에이전트도 같은 DB 운영 판단을 재사용할 수 있도록 `AGENTS.md`와 `.codex/subagent-prompts.md`의 DB 체크리스트를 보강
- `db push` / `migration repair` / `schema sync` 선택 기준을 `docs/05-automation.md`에 decision tree로 정리해 후속 에이전트가 같은 판단을 재사용할 수 있게 함

### Profile Completed Flow Wiring

- `/auth/callback`이 세션 복구 뒤 `user_profiles.profile_completed`를 확인하고, 미완료 정회원을 `/onboarding/profile`로 보내도록 연결
- 홈(`/`)도 기존 로그인 세션에서 프로필 미완료 사용자를 온보딩으로 유도하도록 보강
- 클럽 생성, 일정 생성, 경기 기록 저장/수정은 서비스 계층에서 `requireCompletedProfile()`을 거치도록 정리
- 초대 참가, 이메일 인증 UX, DB/RPC 수준의 강제 가드는 아직 후속 작업으로 남겨 둠

### Match Schedule Request Flow

- `match_schedules`에 `join_policy`(`instant | approval_required`)를 추가하고, 승인형 모집의 신청 상태를 담는 `match_schedule_requests`를 새로 도입
- 일정 생성 화면에서 `바로 참가`와 `승인 후 참가`를 선택할 수 있게 했고, 클럽 홈 카드와 일정 상세 화면에 `참가 신청`, `신청 취소`, `대기 신청 건수`, `승인 대기(reviewing)` 상태를 함께 노출
- 일정 상세에서 개설자가 pending 신청을 수락/거절할 수 있게 연결하고, 신청이 남아 있는 승인형 모집은 상태를 `reviewing`으로 보정해 단순 `open`과 구분되게 정리

## 2026-03-26

### Session Pooler DB Apply

- Supabase direct DB host가 IPv4 호환이 아니어서 `db push` 계열 명령이 실패하던 문제를 session pooler 기반 CLI 연결로 정리
- `.env.local`, `.envrc`에 `SUPABASE_DB_PUSH_URL`을 추가하고, `db:push`, `db:push:dry`, `db:schema:sync`가 이 값을 우선 사용하도록 자동화 스크립트를 고정
- `npm run db:push:dry`로 원격 상태를 확인한 결과, 로컬 마이그레이션 전체가 아직 remote migration history에 반영되지 않은 상태임을 확인
- 다음 세션에서도 같은 판단을 재사용할 수 있도록 `AGENTS.md` 5장/14장과 `docs/05-automation.md`에 session pooler 운영 규칙을 기록
- remote schema dump와 API 체크로 최신 구조가 이미 들어 있음을 확인한 뒤, `supabase migration repair --status applied`로 전체 migration history를 복구
- 복구 후 `supabase migration list`에서 local/remote 버전이 모두 일치하고, `npm run db:push:dry`가 `Remote database is up to date.`로 끝나는 것까지 확인

### Auth / Onboarding Design

- 이메일/카카오 병행 인증과 프로필 완료 가드 설계를 `docs/11-auth-onboarding-design.md`에 별도 문서로 고정
- 전역 프로필(`user_profiles`), `gender`, `profile_completed`, `/auth/check-email`, `/onboarding/profile` 도입 방향을 현재 구현과 분리해서 정리
- UX 백로그에도 `정회원 프로필 온보딩` 항목을 추가해, 설계만 존재하고 실행 순서가 흐려지지 않도록 연결

## 2026-03-20

### DB Automation Connection Fallback

- `scripts/automation/db-push.sh`, `scripts/automation/db-sync-schema.sh`가 direct DB URL만 고정 사용하지 않도록 정리
- 새 헬퍼 `scripts/automation/resolve-db-url.sh`를 추가해 `SUPABASE_DB_PUSH_URL`가 있으면 이를 우선 사용하도록 변경
- direct connection 문자열의 비밀번호에 reserved 문자(`@`, `:`, `/`)가 들어갈 때 URL 인코딩이 필요하다는 점을 예시와 함께 문서화
- IPv4-only/IPv6 미지원 환경에서는 direct host(`db.<project-ref>.supabase.co:5432`) 대신 session pooler를 CLI 전용 연결 문자열로 쓰는 운영 가이드를 추가

## 2026-03-19

### Agent Workflow Bootstrap

- `.codex/agents/`에 `impl`, `db-review`, `ux`, `doc-sync`, `qa` 커스텀 서브에이전트 정의를 추가
- 각 에이전트별로 역할, 책임 범위, 선행 컨텍스트, 금지 사항, 출력물 기대치를 TOML 수준에서 고정
- `AGENTS.md`에 기본 에이전트 역할 지도와 호출 순서를 문서화해 작업 분해 기준을 명확히 정리
- `.codex/subagent-prompts.md`에 에이전트별 호출 템플릿과 오케스트레이션 패턴을 추가
- `AGENTS.md`에 기본 시작 프로토콜을 추가해, 사용자가 서브에이전트 지시를 반복하지 않아도 Codex가 자동으로 탐색 → 역할 분해 → 문서/검증 흐름을 따르도록 정리

### Decision Log

- 구현과 검증, 문서, DB 검토를 분리하되 같은 파일을 여러 에이전트가 동시에 수정하지 않는 구조를 기본 원칙으로 둔다
- `impl`를 코드 변경의 기본 실행자로 두고, `db-review`, `doc-sync`, `qa`는 병렬 검토/판정 역할로 고정한다
- 호출 프롬프트는 자유서술보다 템플릿 기반으로 표준화해, 작업 목표/컨텍스트/수정 범위/출력 형식을 빠뜨리지 않는 쪽을 우선한다
- 사용자가 역할 분리 명령을 직접 쓰지 않아도, 저장소 규칙이 허용하는 범위에서는 Codex가 기본 프로토콜에 따라 적절한 서브에이전트 흐름을 먼저 제안하고 실행하는 쪽을 기본값으로 둔다

### Community / Matching Direction

- 다음 제품 확장 카테고리를 `커뮤니티`, `클럽 내 일정 기반 매칭 시스템` 2축으로 고정
- 현재 일정 생성/참가의 최소 루프는 이미 구현된 상태로 보고, 후속 우선순위를 `일정 상세`, `호스트 관리 액션`, `일정 -> 실제 경기 연결`로 재정렬
- 커뮤니티 기능은 별도 도메인을 성급하게 분리하기보다, 우선 일정 엔티티를 중심으로 참가 맥락과 후속 액션을 강화하는 방향으로 정리

### Schedule Detail MVP

- 클럽 홈 upcoming 일정 카드에 `상세 보기` CTA를 추가
- 새 라우트 `/clubs/[clubId]/schedules/[scheduleId]`를 추가해 일정 상세, 참가자 목록, 비용, 메모, 남은 자리, 참가/취소 액션을 한 화면에서 확인할 수 있게 정리
- `linked_match_id`는 상세 응답에 포함해 이후 일정 -> 실제 경기 연결 CTA를 붙일 수 있는 기반을 마련

### Browser QA / Schema Notice Policy

- UI/라우트 변경 후 기본 브라우저 검증을 `cmux browser` 기준으로 수행하도록 작업 규칙을 강화
- `scripts/automation/cmux-browser-check.sh`와 `npm run browser:check`를 추가해 로컬 페이지 접속, title/url 확인, compact snapshot 출력을 자동화
- 스키마 변경 작업이 있으면 종료 시 사용자에게 변경 파일과 수동 반영 필요 여부를 명시적으로 알리는 규칙을 추가

### Schedule Creation UX Refinement

- 일정 생성 화면에서 캘린더 선택 강조를 더 강하게 주고, 시간 선택을 연속 슬롯 기반 범위로 확장
- 코트비, 캔볼 가격, `본인 포함`을 체크 기반으로 전환하고 기본값은 모두 체크 상태로 유지
- `본인 포함`을 끄면 개설자는 운영자로만 남고 참가자에 자동 포함되지 않도록 `create_match_schedule` RPC와 프론트 로직을 함께 수정
- 일정 카드/상세에 `개설자 미포함` 상태를 노출하고, 인당 예상 비용 안내를 더 명확하게 정리

## 2026-03-17

### Match Schedule MVP

- `match_schedules`, `match_schedule_participants` 테이블과 일정 생성/참가/취소용 RPC를 추가
- 일정은 경기 결과 엔티티(`matches`)와 분리하고, 개설자 자동 참가와 정원 마감 계산을 DB에서 보장하도록 설계
- 일정 입력 항목은 `날짜/시간`, `장소`, `코트 비용`, `캔볼 가격`, `모집 인원`, `남복/여복/성별무관`, `메모`를 기준으로 정리

### UI / UX

- `새 경기` 화면에 `경기 기록`과 `일정 잡기` 모드 전환을 추가
- 클럽 홈에 upcoming 일정 카드와 `참가하기/참가 취소` 액션을 추가
- 일정 생성 시 개설자가 자동 포함되며, 남은 자리를 `정원 - 현재 참가자 수`로 바로 안내
- 기본 브라우저 `date/time` 입력 대신 `react-day-picker` 기반 인라인 캘린더와 클릭형 시간 선택 UI로 일정 생성 화면을 다듬음
- 일정 스키마 미적용 시 generic 에러 대신 `마이그레이션 먼저 실행` 안내가 보이도록 에러 매핑을 추가
- 일정 생성은 다중 날짜/시간 저장처럼 해석이 갈리는 입력 대신 `한 번에 하나의 일정 생성` 흐름으로 다시 고정
- 일정 생성 화면에 `내일/이번 토/이번 일` 빠른 날짜 버튼과 생성 전 요약 카드를 추가해 운영진이 바로 검토 후 저장할 수 있게 정리
- 입력 중 에러는 필드 수정 시 바로 지워지게 해, 잘못된 값 수정 후에도 이전 에러가 화면에 남아 사용자를 방해하지 않도록 조정

### Decision Log

- 일정/모집은 기존 경기 기록 상태(`submitted/confirmed/disputed`)와 의미가 다르므로 별도 엔티티로 분리한다
- `남복/여복/성별무관`은 우선 모집 타입으로 저장하고, 실제 성별 검증은 멤버 프로필 확장 이후에 연결한다
- 이후 채팅방과 실제 경기 기록 연결은 일정 ID를 기준으로 확장하는 방향을 기본으로 삼는다
- 현재 일정 생성은 `복수 후보 제안`보다 `운영진이 즉시 확정 가능한 단일 일정 오픈` 문제를 먼저 푸는 쪽이 제품 우선순위에 맞다

## 2026-03-13

### PM / MVP Direction

- 제품 포지셔닝을 `개인 테니스 기록 앱`보다 `클럽 운영용 경기 기록 플랫폼` 관점으로 명시
- 1차 고객을 개인 사용자가 아니라 `클럽 운영진`으로 두고, 도입/정착/재방문 구조를 다시 정리
- 핵심 활성화 루프를 아래 3가지로 고정
  - 정모 기록 루프
  - 클럽 내 경쟁 루프
  - 운영 편의 루프

### Documentation Alignment

- `docs/01-product-canvas.md`에 제품 포지셔닝, 핵심 사용자 유형, 활성화 루프, MVP 원칙/우선순위, 추가 지표를 반영
- `README.md`에 클럽 단위 플랫폼 관점과 MVP 우선순위를 요약
- `docs/08-ux-tasks.md`에 홈 대시보드, 도입 퍼널, 기록 속도, 미확정 후속 처리 중심의 실행 백로그를 추가

### Decision Log

- MVP는 많은 기능보다 `클럽 생성 -> 초대 -> 첫 경기 기록 -> 확인 -> 재방문` 루프를 먼저 검증한다
- 재방문 동기는 입력 기능보다 `내 경기`, `클럽 최근 활동`, `리더보드`, `확인 대기` 조회 경험에서 만든다
- 운영진이 현장에서 빠르게 기록할 수 있는지가 초기 도입 성공의 가장 중요한 기준이다

## 2026-02-27

### Infra Bootstrap

- Next.js + Tailwind + shadcn 초기화
- GitHub 원격 연결 및 `main/develop` 브랜치 구성
- Supabase 스키마(`supabase/schema.sql`) 및 RLS 정책 작성
- Vercel 프로젝트 `tournament-record-vercel` 링크 및 production 배포 확인

### UI/Foundation

- 모바일 우선 랜딩 레이아웃으로 개편
- 디자인 토큰(`--brand`, `--surface-*`) 추가
- 소형 화면 기준 CTA/카드 가독성 개선

### Docs

- `docs/` 문서 체계 도입
- 제품 캔버스/디자인 시스템/아키텍처/작업 로그 분리

### Feature (Record Flow v1)

- 홈 화면에 `클럽 생성`, `참가 코드 입장`, `내 클럽 목록` UI 구현
- 참가 코드 가입용 RPC `join_club_by_invite` 스키마 추가

### Automation

- Supabase CLI 초기화(`supabase/config.toml`) 및 마이그레이션 파일 생성
- 자동화 스크립트 추가:
  - `env:check`, `db:smoke`, `db:push:dry`, `db:push`, `verify`
- GitHub Actions CI(`.github/workflows/ci.yml`) 추가

### Refactor (Feature-based)

- `/Users/minhyun/Desktop/client`의 홈/레이아웃 패턴을 참고해 모바일 탭형 홈 구조로 재구성
- `src/features/clubs` 단위로 분리:
  - `components`, `hooks`, `services`, `types`
- App Router(`src/app/page.tsx`)는 조립 역할만 수행하도록 경량화

### Auth Update

- 익명 로그인 제거
- 카카오 OAuth 로그인 게이트(`카카오로 시작하기`) 추가
- 이메일/비밀번호 로그인 및 회원가입 추가
- 개발 편의 옵션 `NEXT_PUBLIC_ALLOW_GUEST_MODE` 추가
- 로그인 사용자만 클럽 생성/참가/목록 기능 접근 가능하도록 가드 적용

### Decision Log

- 사용자 타깃 특성을 고려해 이메일 OTP 대신 카카오 로그인 우선 전략 채택
- Supabase는 단일 프로젝트로 운영하고, 브랜치는 Git/Vercel 레벨에서 분리 관리

## 2026-03-04

### UX Polish

- `ClubDashboard`에서 비로그인 상태 전체 중앙 정렬을 제거하고, `busyType === "loading"`일 때만 스피너를 중앙 배치하도록 수정
- 로딩 완료 후 콘텐츠는 상단 기준 레이아웃으로 유지되게 정리

### Match Record Guardrails

- 경기 생성 화면에서 클럽 멤버가 2명 미만일 때 `EmptyState`로 기록 불가 사유와 이동 액션 제공
- 경기 생성 폼 폭을 `max-w-xl`로 제한해 모바일/데스크탑 모두 입력 집중도 개선
- 복식 선택은 멤버 수 조건(`4명 이상`) 기준으로 제어되도록 연동

### Auth Refactor & Kakao Logout

- 인증 함수(`getCurrentUser`, `ensureSessionUser`, `signIn*`, `signOut`, `requireUser`)를 `src/features/auth/services/auth.ts`로 분리
- `clubs.ts`는 클럽 도메인 로직만 유지하고 인증 의존은 `auth` 서비스 import로 정리
- `signOut`에서 카카오 사용자(`app_metadata.provider === "kakao"`)인 경우 Supabase 로그아웃 후 카카오 로그아웃 URL로 리다이렉트 추가
- 환경변수 `NEXT_PUBLIC_KAKAO_REST_API_KEY` 사용

### Auth State Sync

- `useClubDashboard`에 `onAuthStateChange` 구독 추가
- `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED` 이벤트에서 `refreshClubs()`를 호출하도록 반영
- OAuth 콜백 직후 사용자/클럽 목록 상태 반영 지연을 줄이도록 개선

### Match UX Terminology & Input Redesign

- 점수 입력 UI를 체크박스 방식에서 버튼형 단일 선택 방식으로 전환
- `라운드` 표기를 `게임`으로 정리하고, 히스토리/상세에서 팀 이름 기반 표기로 가독성 개선
- 예외 기록(진행/중단) 상태를 히스토리 카드에서 식별 가능하게 노출

## 2026-03-05

### Club Settings (Owner/Nickname)

- 클럽 상세에 `클럽 이름 변경(클럽장 전용)` 폼 추가
- 클럽 상세에 `내 닉네임 변경` 폼 추가
- 클럽 설정 변경용 RPC 연동: `update_club_name`, `update_my_club_nickname`
- 중복 방지/검증을 위한 DB 제약 추가:
  - `clubs` 이름 정규화 unique
  - `club_members`(club_id + 닉네임 정규화) unique
  - 클럽명/닉네임 길이 check(2~24자)

### Club Member Self Settings

- 클럽명 변경 UI는 클럽장(owner)에게만 노출되도록 유지(멤버 비노출)
- 내 닉네임 변경 위치를 클럽 정보 카드에서 멤버 목록의 `내 항목`으로 이동
- `카카오 프로필 공개`, `전적 검색 허용`, `내 경기 히스토리 공개` 개인 설정 추가
- 개인 설정 저장 RPC `update_my_club_member_settings` 도입

### Dialog Refactor (shadcn)

- 클럽명 수정/내 설정 수정을 페이지 인라인 폼에서 다이얼로그 기반 UX로 전환
- `@radix-ui/react-dialog` + 공용 `Modal` 래퍼 도입
- 편집 관련 코드를 분리 컴포넌트로 분리해 화면 컴포넌트 복잡도 축소

### Match History UX Upgrade

- 히스토리에 `카드/리스트` 보기 전환 추가
- 필터 영역을 Chevron 토글(기본 접힘)로 변경
- 필터 항목: `날짜` + `상대 이름` 적용
- 무한 스크롤(초기 16개 + sentinel) 적용
- 리스트 모드를 최소형(`팀A x:y 팀B`)으로 축소
- 리스트 승패 표현을 배지 대신 얕은 배경색(`green-light`/`red-light`)으로 전환
- 승패 계산 기준을 `side1 고정`에서 `현재 로그인 사용자 기준`으로 수정
- 중간 날짜 그룹 헤더 제거(리스트 스캔 집중도 개선)

### Design Tokens

- 결과 강조용 토큰 추가/연결:
  - `--color-green-primary`, `--color-green-light`
  - `--color-red-primary`, `--color-red-light`
- 관련 가이드를 `docs/10-history-ui-guidelines.md`로 문서화

## 2026-03-06

### Invite Flow & Guest Policy

- 원클릭 초대 링크 페이지 추가: `/join/[inviteCode]`
- 초대 링크 진입 후 `카카오/이메일/게스트` 선택 참가 플로우 추가
- 클럽 상세에 `링크 복사`, `카카오톡 공유` 액션 추가
- 초대 코드 만료일(`invite_expires_at`) 도입, 방장(owner) 전용 재발급 RPC 연동

### Permission Hardening

- `club_member_role`에 `guest` 추가
- 게스트는 클럽 참가는 가능하되 경기 생성/수정은 불가하도록 정책 강화
- 경기 생성은 정회원(owner/manager/member)만 허용
- 경기 수정/결과 수정은 `owner/manager/생성자`만 허용

### Auth/Onboarding

- 이메일 로그인/회원가입 경로를 홈 인증 게이트에서 유지
- 게스트 사용자는 홈에서 `클럽 만들기` 탭 비노출

### Club Member Lifecycle

- 방장(owner) 멤버 제외 기능 추가(`remove_club_member`)
- 멤버 제외는 소프트 삭제(`is_active=false`, `left_at`)로 처리
- 과거 경기/히스토리 참조 무결성(FK) 유지

### Layout Standardization

- 주요 화면을 `AppBar + content(px-4)` 패턴으로 통일
- `LoadingSpinner`를 공통 중앙 정렬 + `title/message` 구조로 통일

## 2026-03-10

### Match Confirmation UX Follow-up

- `submitted` 상태 카피를 사용자 관점의 `기록됨` 중심으로 정리하고, `disputed`는 `재검토 필요`로 통일
- 경기 상세에 확인 대상 닉네임과 현재 승인/거절 맥락을 함께 노출
- `disputed` 경기에서 수정 후 다시 저장하면 새 확인 요청이 전송된다는 재제출 흐름을 상세/수정 화면에서 명시
- 확인 상태 공용 유틸과 테스트를 추가해 카드/배지/상세 카피가 다시 갈라지지 않게 정리
- 경기 상세는 `matches.status`만 그대로 쓰지 않고 `match_confirmations` 결정값을 기준으로 상태를 한 번 더 보정하도록 수정
- 히스토리 목록도 동일하게 `match_confirmations` 결정값으로 상태를 보정해 카드와 상세의 `미확정/확정` 불일치를 제거
- 히스토리 카드에서는 미확정 경기를 `기록됨/재검토`로 쪼개지 않고 결과 배지 `미확정` 하나로 단순화
- 카드의 `미완료 게임 포함` 보조 뱃지는 제거하고, 상세 맥락은 상태/점수 요약에 집중하도록 정리
- 클럽 상세의 초대 코드 액션은 2열 grid 대신 역할 조건에 자연스럽게 줄어드는 flex로 정리해 비방장 화면의 버튼 정렬 어색함을 제거

### Optimization / UI & UX Sweep

- 클럽 상세의 이름 변경, 내 설정 저장, 초대 코드 재발급, 멤버 제거는 전체 `refresh` 대신 로컬 상태를 우선 갱신하도록 바꿔 모바일 반응성을 개선
- 클럽 상세에 `링크 복사`, `링크 공유`, `재발급(owner)` 흐름을 추가해 초대 경험과 문서 기준을 다시 맞춤
- `/join/[inviteCode]`는 임시 비활성화 카드 대신 실제 `InviteJoinView`를 다시 사용하도록 복구
- 홈 인증 게이트, 초대 참가 화면, 멤버 리스트, 히스토리 상단 토글을 모바일 우선 배치로 정리해 320px에서 버튼 밀집을 줄임
- 홈에서 클럽이 없는 사용자는 게스트/정회원 여부에 따라 `참가` 또는 `만들기`로 더 자연스럽게 유도
- 히스토리 목록은 filter/view 전환 시 불필요한 remount를 제거하고, 상대 검색은 `내 상대` 기준으로 더 정확하게 동작하도록 조정

### Home / Confirmation / History Follow-up

- 홈 기본 탭은 자동으로 `create/join`으로 넘기지 않고 다시 `내 클럽(list)`를 유지하도록 정리
- 상태/확인 플로우는 목록과 상세가 동일한 상태 보정 로직을 사용하도록 유지
- 히스토리 성능은 전체 remount 제거와 상대 검색 정밀화 중심으로 먼저 개선

### Match Save / Confirmation Flow

- 미완료 게임도 저장 가능하도록 경기 저장 검증 완화
- 게임 입력의 미완료 상태 카피를 `진행/중단`에서 `미완료`로 정리
- 경기 등록/수정 시 즉시 확정 대신 `submitted`로 저장하도록 변경
- 상대 팀 확인용 `match_confirmations` 테이블 및 승인/거절 액션 도입
- 상대 확인 완료 시 `confirmed`, 거절 시 `disputed`로 전환
- 리더보드는 `confirmed` 경기만 반영하도록 조정

### Documentation Alignment

- 루트 `AGENTS.md`를 추가해 작업 규칙과 문서 관리 규칙을 중앙화
- `README.md`에 게스트 참가/경기 확인 플로우/확정 경기 기준 리더보드 반영
- `docs/01-product-canvas.md`에 상대 확인 기반 신뢰도 가설과 지표 반영
- `docs/05-automation.md`에 match confirmation 관련 필수 SQL 및 운영 규칙 반영
- `docs/08-ux-tasks.md`에 완료된 경기 확인 플로우와 남은 재제출 UX 과제 정리
- `docs/10-history-ui-guidelines.md`에 `submitted`/`disputed` 중립 표현 규칙 반영

### Club Navigation UX

- 클럽 탭성 화면(`홈`, `새 경기`, `히스토리`, `리더보드`) 상단에서 뒤로가기를 제거
- 클럽 홈 상단 우측에만 `다른 클럽` 버튼을 두고, 다른 탭에는 제거
- 히스토리 상단 우측은 확인 요청 알림 버튼으로 전환
- 경기 상세에서는 승인 대상 사용자에게만 승인/거절 액션이 보이도록 확인 판정 로직을 보강

### Agent Harness Guidance

- `AGENTS.md`에 역할 분리, 병렬 실행, MCP, 실시간 상태 추적, 자동화에 대한 저장소 전용 도입 원칙 추가
- 범용 생산성 조언을 그대로 복사하지 않고 `tournament-record` 기준 우선순위와 운영 규칙으로 재정리
- 로컬 Codex CLI(`0.112.0`) 기준 `multi_agent` feature를 실제 활성화하고, `AGENTS.md`에 활성화/확인/사용 패턴 문서화
- Codex global MCP에 `playwright`, `context7`, `exa`를 등록하고 저장소 기준 사용 우선순위를 `AGENTS.md`에 반영
- GitHub 공식 MCP를 `GITHUB_TOKEN` bearer auth 방식으로 등록하고, PR/이슈 연동 용도를 `AGENTS.md`에 추가
- 프로젝트 전용 시크릿은 `direnv`(`.envrc` + `.envrc.local`)로 주입하는 방향으로 정리
- `~/.zshrc`의 전역 `GITHUB_TOKEN` export를 제거하고, 이 저장소에서만 `direnv`로 GitHub MCP 인증을 주입하도록 정리

## 2026-03-20

- 일정 생성 화면의 날짜 선택 강조를 캘린더 셀 자체의 원형 선택 상태로 정리하고, `내일/이번 일` 빠른 날짜 버튼과 시간 기본값을 제거했다. 사용자가 직접 날짜와 시간을 명확히 고르는 흐름으로 맞췄다.
- 일정 생성 시간 선택을 `직접 입력`에서 `시작/종료 드롭다운 + 시간칸 미세 조정` 구조로 바꿨다. 모바일에서 한 손으로 조작하기 쉬운 흐름을 우선했다.
- 일정 생성은 2단계 흐름으로 분리했다. 1단계에서 날짜/시간/장소를 먼저 고정하고, 2단계에서 비용/모집/메모를 정리한다. 생성이 끝나면 성공 화면에 머물지 않고 바로 일정 상세로 이동한다.
- 클럽 홈 `다가오는 일정` 섹션에 생성 직후 확인 경로를 안내하는 문구를 추가해 일정이 어디에 생기는지 더 명확하게 드러냈다.
- `AppShell`을 뷰포트 고정 캔버스로 바꾸고, 스크롤은 내부 `main` 영역만 담당하게 조정했다. 하단 바텀 네비게이션은 스크롤에 휩쓸리지 않고 항상 고정된 위치를 유지한다.
- 루트 `html/body`도 뷰포트 높이로 고정하고 overflow를 잠가서, 문서 전체 스크롤이 생기지 않도록 정리했다.
- Supabase 자동화에 `npm run db:schema:sync`를 추가했고, `npm run db:push` 뒤에는 `supabase/schema.sql`을 자동으로 다시 덤프하도록 연결했다. 대시보드 수동 반영 후에도 로컬 스키마를 맞출 수 있게 했다.
