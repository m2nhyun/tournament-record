# Club Record Checklist

## Purpose

이 문서는 `club_record`를 실제 구현/적용하기 전에 확인해야 하는 체크리스트를 정리한다.
설계 문서와 migration 초안이 이미 있어도, 이 체크리스트 없이 바로 반영하면 권한/데이터 초기화/히스토리 누락 문제가 생길 수 있다.

## Read Before Work

1. [README.md](./README.md)
2. [03-schema.md](./03-schema.md)
3. [04-access.md](./04-access.md)
4. [05-implementation.md](./05-implementation.md)
5. [08-review-findings.md](./08-review-findings.md)

## Pre-Migration Checklist

### Schema

- 기존 `club_members.role` 체계가 `owner | manager | member | guest`로 유지되는지 확인
- `is_club_member`, `is_club_admin`, `set_updated_at` 함수가 최신 상태인지 확인
- `club_record` 전용 enum 이름이 기존 enum과 충돌하지 않는지 확인
- `auth.users` 참조를 사용하는 테이블이 현재 인증 플로우와 맞는지 확인
- `guest_user_id`를 실제 카카오 로그인 사용자로 볼 수 있는지 다시 확인

### Data Model

- `club_record_members`를 기존 `club_members` 기준으로 어떻게 초기화할지 결정
- 초기 랭킹을 전부 수동으로 넣을지, 임시 순번을 자동 부여할지 결정
- `group_a_percent / group_b_percent / group_c_percent` 초기값 `20/30/50`을 그대로 쓸지 확인
- 게스트가 회원 전환될 때 `linked_club_member_id`를 어느 시점에 연결할지 확인

### Access

- 회원이 이벤트 참가자 목록을 어느 정도까지 볼 수 있는지 UI DTO 기준으로 다시 확인
- 게스트에게 노출할 이벤트 정보 범위를 다시 확인
- 월간 공개 카드에 게스트를 포함하지 않는 것이 맞는지 확인
- 운영 메모는 어떤 화면에서도 운영진/관리자만 보이게 되는지 확인

### Lifecycle

- 이벤트 시간 변경 시 참가자/슬롯/경기 초기화를 정말 모두 수행할지 다시 확인
- `confirmed` 경기 존재 시 이벤트 시간/코트 변경과 cascade 삭제가 차단되는지 확인
- `confirmed` 경기 존재 시 이벤트 소프트 삭제/취소가 서비스와 trigger 양쪽에서 차단되는지 확인
- 이벤트 소프트 삭제 시 어떤 화면에서 숨길지 확인
- 취소된 경기는 운영진만 조회 가능한지 확인
- 결과 무효화 기능을 이번 범위에서 제외하는 것이 맞는지 확인

## Migration Execution Checklist

### Apply Order

핵심 도입:

1. `20260506120000_add_club_record_core.sql`
2. `20260506121000_add_club_record_event_tables.sql`
3. `20260506122000_add_club_record_result_tables.sql`
4. `20260506123000_add_club_record_rls_and_functions.sql`
5. `20260507094500_fix_club_record_ranking_move.sql`
6. `20260507095500_fix_club_record_guest_join_conflicts.sql`
7. `20260507100500_fix_club_record_result_update_conflict.sql`
8. `20260508093000_add_club_record_member_sync.sql`
9. `20260508094000_restrict_club_record_member_sync_grant.sql`
10. `20260512113000_fix_club_record_history_guest_names.sql`
11. `20260512120500_add_club_record_history_team_names.sql`

> 운영 DB 적용 이력: 2026-05-08(1~9), 2026-05-12(10~11). 자세한 내용은 `docs/club-record/07-handoff.md` "Migration Apply Log" 참고.

### After Each Migration

- enum 생성 여부 확인
- table 생성 여부 확인
- foreign key / unique / index 생성 여부 확인
- `updated_at` trigger 연결 여부 확인
- RLS enable 여부 확인
- helper function 생성 여부 확인

## Post-Migration Verification

실제 적용 후 도메인 DB smoke는 아래 파일을 기준으로 확인한다.

```bash
psql "$SUPABASE_DB_PUSH_URL" -f supabase/tests/club_record_smoke.sql
```

### DB Checks

- `club_record_settings` insert 가능 여부
- `club_record_members` insert 가능 여부
- 랭킹 이동 함수가 `unique (club_id, ranking_position)` 충돌 없이 인접/원거리 이동을 처리하는지 확인
- `club_record_events` 생성 가능 여부
- `club_record_event_participants`에 member / guest 각각 insert 가능 여부
- member participant insert 시 event club과 member club이 DB 경계에서 일치 검증되는지 확인
- `club_record_event_slots` 생성 가능 여부
- `club_record_matches`, `club_record_match_players`, `club_record_match_results` insert 가능 여부
- `confirmed` match direct delete가 trigger에서 차단되는지 확인
- `confirmed` match가 있는 event soft delete/status cancel이 trigger에서 차단되는지 확인
- slot 삭제 cascade가 `confirmed` match 삭제 trigger에서 차단되는지 확인
- 연결 경기 참가자 direct delete가 trigger에서 차단되고, 참가자 삭제 RPC는 pending/cancelled 경기 정리 후 동작하는지 확인
- 자동/수동 경기 생성 RPC가 늦참자의 `arrival_time`보다 이른 슬롯 배정을 차단하는지 확인

### Permission Checks

- 운영진/관리자는 랭킹 조회 가능
- 회원은 랭킹 조회 불가
- 회원은 본인 경기 결과만 insert 가능
- 비활성 멤버는 과거 참가자 row가 있어도 이벤트/경기 참가자 helper와 결과 입력 권한을 통과하지 못함
- 게스트는 결과 insert 불가
- 회원은 본인 히스토리만 조회 가능
- 운영진은 전체 히스토리 조회 가능
- 취소된 이벤트/경기는 회원에게 노출되지 않는지 확인
- 이벤트 슬롯 overview는 운영진/관리자 또는 해당 이벤트 참가자에게만 노출되는지 확인

### Function Checks

- `is_club_record_event_participant`
- `is_club_record_match_participant`
- `can_submit_club_record_result`
- `cancel_expired_club_record_matches`
- `verify_club_record_guest_invite_code`
- 게스트 초대코드 검증 이후 비관리자 게스트 참가 등록까지 RLS/RPC 경계에서 성공하는지 확인
- `get_club_record_monthly_public_card`
- 월간 공개 카드가 `win_rate` scale을 UI와 일치시키고, archived/cancelled event를 집계에서 제외하는지 확인

## Implementation Checklist

### Phase 1

- 타입 정의 추가
- 서비스 스캐폴딩 추가
- 에러 타입 정의
- 기본 DTO shape 정의

### Phase 2

- 랭킹 조회/수정 서비스
- 그룹 비율 조회/수정 서비스
- 이벤트 생성/수정/삭제 서비스
- 참석자/게스트 관리 서비스

### Phase 3

- 슬롯 생성 로직
- 수동 경기 생성/삭제
- 결과 입력/수정/취소
- 월간 카드 조회

### Phase 4

- 자동 편성 로직 상세 구현
- 운영진 화면 연결
- 회원 화면 연결

### Phase 5

- 반응형 정리
- UI/UX polish

## Current High-Risk Areas

1. `08-review-findings.md`의 P1/P2 항목이 해결됐는지
2. `guest_user_id`가 실제 로그인 사용자와 완전히 일치하는지
3. 이벤트 시간 변경 시 기존 데이터 초기화 범위를 서비스에서 안전하게 강제하는지
4. confirmed 경기를 direct delete나 FK cascade로 잃지 않도록 trigger가 막는지
5. 참가자 목록/선수 구성 응답에서 민감정보가 새어나가지 않는지
6. 월간 공개 카드 집계 기준이 운영 의도와 정확히 맞는지
7. 자동 편성 상세 규칙을 너무 늦게 확정해 서비스 구조를 다시 흔들지 않는지

## Recommended Next Step

다음 실제 작업은 아래 순서가 가장 안전하다.

1. migration SQL 정합성 1차 리뷰
2. migration 적용 전 dry review
3. 타입/서비스 파일 스캐폴딩
4. core service 구현
