# Club Record Schema

## New Enums

- `club_record_group_code`
- `club_record_event_status`
- `club_record_participant_type`
- `club_record_attendance_status`
- `club_record_slot_status`
- `club_record_match_status`

## Core Tables

### club_record_settings

- 클럽별 그룹 비율 저장
- `group_a_percent`, `group_b_percent`, `group_c_percent`

### club_record_members

- 랭킹/그룹/출석/경기수/운영메모
- `unique (club_id, ranking_position)`
- `attendance_count`는 삭제되지 않은 이벤트 참가 등록 기준으로 재계산
- `match_count`는 자동/수동 구분 없이 `confirmed` 경기 기준으로 재계산
- `sync_club_record_members(club_id)` RPC가 활성 `club_members` 중 아직 랭킹에 없는 정회원/운영진/방장을 append하고 그룹을 재계산한다

### club_record_guest_profiles

- 게스트 장기 식별자
- 카카오 계정 기준 누적 보존
- 이후 회원 전환 연결

### club_record_events

- 날짜/시간/코트 수
- 소프트 삭제 지원
- `assignment_dirty`: 참가자/수동편성 변경 후 재편성 필요 여부
- `last_assignment_run_at`: 마지막 자동 편성 실행 시각

### club_record_event_participants

- 회원/게스트 통합 참석자
- 늦참 시각 포함

### club_record_event_slots

- 코트별 시간표 슬롯
- `is_locked`, `status` 변경 추적을 위해 `updated_at` 유지
- 슬롯 삭제가 FK cascade로 `confirmed` 경기를 지우지 않도록 match 삭제 방지 trigger를 둔다

### club_record_matches

- 슬롯 기반 경기
- `assignment_mode = auto | manual`
- `confirmed` 경기는 직접 삭제를 차단한다

### club_record_match_players

- 경기 참가자 4명과 팀 구성
- 참가자 direct delete로 선수 구성이 깨지지 않도록 연결 경기 참가자 삭제를 trigger에서 차단한다

### club_record_match_results

- `score_text` 문자열
- `winning_side`, `losing_side`, `is_draw`
- 결과 입력자 participant는 반드시 해당 경기 참가자여야 함
- 단, 운영진이 취소 경기 결과를 사후 입력하는 경우 `entered_by_participant_id`는 null 허용

### Monthly public card

- `get_club_record_monthly_public_card.win_rate`는 `0..100` percentage scale이다.
- UI는 이 값을 다시 `* 100`하지 않고 반올림 후 `%`로 표시한다.

### club_record_ranking_audits

- 랭킹 변경 이력

## Constraint Direction

- 랭킹은 연속 관리, 공동 순위 없음
- 스코어는 빈 문자열 불가
- 무승부면 `winning_side`, `losing_side`는 null
- 승패면 `winning_side != losing_side`

## Index Direction

- 랭킹: `(club_id, ranking_position)`
- 그룹: `(club_id, group_code)`
- 이벤트: `(club_id, event_date)`, `(club_id, status)`
- 참가자: `(event_id, participant_type)`, `(event_id, arrival_time)`
- 경기: `(event_id, status)`

## Migration Split

핵심 도입(2026-05-06 ~ 05-08):

1. `20260506120000_add_club_record_core.sql`
2. `20260506121000_add_club_record_event_tables.sql`
3. `20260506122000_add_club_record_result_tables.sql`
4. `20260506123000_add_club_record_rls_and_functions.sql`
5. `20260508093000_add_club_record_member_sync.sql`
6. `20260508094000_restrict_club_record_member_sync_grant.sql`

후속 fix / 보강:

7. `20260507094500_fix_club_record_ranking_move.sql` — `move_club_record_ranking` 임시 오프셋 알고리즘 (RF-001)
8. `20260507095500_fix_club_record_guest_join_conflicts.sql` — 게스트 초대 RPC on-conflict 명시 (RF-002)
9. `20260507100500_fix_club_record_result_update_conflict.sql` — 결과 업데이트 충돌 해소
10. `20260512113000_fix_club_record_history_guest_names.sql` — 히스토리에 게스트 표시명 포함
11. `20260512120500_add_club_record_history_team_names.sql` — history RPC가 `team_names text[]`를 반환하도록 확장

## Existing Integration

- `clubs`: 최상위 소유 단위
- `club_members`: 클럽 소속/권한 기준
- `auth.users`: 행위 주체 추적
- `user_profiles`: 카카오 기반 사용자 프로필 후보

## Seed Direction

- 기존 `club_members` 기준 `club_record_members` 초기화는 운영진/관리자가 랭킹 화면의 동기화 액션으로 실행한다
- 그룹 기본값 `20 / 30 / 50`
- 초기는 운영진 수동 정렬 허용
