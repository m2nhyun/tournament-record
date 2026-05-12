# Club Record Domain

## Domain Boundary

- 기존 `matches`: 일반 경기 기록
- 기존 `match_schedules`: 일정/모집
- 새 `club record`: 클럽 랭킹 기반 데일리 매치 운영

## Core Entities

1. `club_record_settings`
2. `club_record_members`
3. `club_record_guest_profiles`
4. `club_record_guest_invites`
5. `club_record_events`
6. `club_record_event_participants`
7. `club_record_event_slots`
8. `club_record_matches`
9. `club_record_match_players`
10. `club_record_match_results`
11. `club_record_ranking_audits`

## Relationships

- `clubs` 1:N `club_record_events`
- `club_members` 1:1 `club_record_members`
- `club_record_events` 1:N `club_record_event_participants`
- `club_record_events` 1:N `club_record_event_slots`
- `club_record_event_slots` 1:0..1 `club_record_matches`
- `club_record_matches` 1:N `club_record_match_players`
- `club_record_matches` 1:1 `club_record_match_results`

## Status Model

### event

- `draft`
- `open`
- `in_progress`
- `completed`
- `cancelled`

### participant

- `registered`
- `checked_in`

### slot

- `scheduled`
- `ready`
- `completed`
- `cancelled`

### match

- `pending_result`
- `confirmed`
- `cancelled`

## Domain Rules

- 이벤트가 최상위 부모
- 참가자는 이벤트에 먼저 등록
- 슬롯은 시간표 단위
- 경기는 슬롯 단위로 생성
- 결과는 경기 단위로 기록
- 그룹은 랭킹을 보조하는 운영 구간
- 슬롯 상태와 이벤트 상태는 경기/참가자 데이터 기준으로 자동 동기화
- 참가자 삭제는 연결된 경기 상태를 확인한 뒤 처리
- `confirmed` 경기가 연결된 참가자는 삭제하지 않고 경기 단위 조정으로 유도
- `pending_result`/`cancelled` 경기만 연결된 참가자는 관련 경기를 정리한 뒤 삭제

## Assignment V1

- 비슷한 랭킹끼리 우선 묶음
- 완전 고정 조합은 피함
- 같은 날 동일 페어 재사용은 우선 피하되, 참가자가 부족하면 허용
- 빈 슬롯이 있으면 같은 사람도 재사용해 최대한 채움
- 같은 날 같은 사람끼리 같은 매치에 함께 등장하는 횟수는 기본 2회 이하를 선호하되, 슬롯 생성을 막는 하드 제한으로 쓰지 않음
- 경기 수는 상한보다 균등 배분 우선순위로만 사용
- 같은 시간대 다중 코트에서는 한 사람의 동시 중복 배정을 허용하지 않음
- 늦참 반영
- 수동 경기 슬롯은 자동 편성에서 제외

## Deferred

- 자동 매칭 세부 알고리즘
- 이벤트 완료 시점 세부 판단
- 결과 무효화 상태
