# Club Record Access

## Access Matrix

### 관리자

- 전체 랭킹 조회/수정
- 이벤트 생성/수정/소프트 삭제
- 참석자/게스트 관리
- 자동 편성 실행
- 수동 경기 생성/삭제
- 결과 수정/재입력
- 운영 메모 조회/수정

### 운영진

- 관리자와 거의 동일
- 단, 관리자 지정/해제 불가

### 회원

- 본인 이벤트/경기 조회
- 본인 히스토리 조회
- 월간 공개 카드 조회
- 본인 경기 결과 입력

### 게스트

- 초대된 이벤트 범위 조회
- 결과 입력 불가

## Service Layers

### settings service

- 그룹 비율 조회/수정
- 운영진 이상 capability 확인 후 접근

### ranking service

- 랭킹 이동
- 클럽 회원 랭킹 동기화
- 그룹 재계산
- audit 기록
- 운영진 이상 capability 확인 후 접근

### guest service

- 게스트 프로필 upsert
- 초대코드 발급/검증
- 초대코드 기반 게스트 join 진입
- 회원 전환 연결

### event service

- 이벤트 생성/수정/소프트 삭제
- 시간/코트 변경 시 초기화
- 진행도 갱신 helper 호출

### participant service

- 참석자 추가/삭제
- 늦참 등록
- `assignment_dirty` 상태 관리

### assignment service

- 자동 편성 실행
- 수동 경기 생성
- 수동 선수 교체
- 자동 경기 삭제
- 자동 편성 적용은 여러 DML을 프론트에서 순차 실행하지 않고 RPC 단위로 처리
- 수동 경기 생성/삭제도 RPC 단위로 처리

### result service

- 결과 입력
- 스코어 파싱
- 승/패/무 계산
- 취소 경기 재입력

### history service

- 본인 히스토리
- 운영진 전체 히스토리
- 월간 공개 카드
- 본인/운영진/공개 카드 capability를 서비스 진입에서 먼저 확인

## RPC / Helper Function Direction

- `get_my_active_club_member_id`
- `is_club_record_event_participant`
- `is_club_record_match_participant`
- `can_submit_club_record_result`
- `cancel_expired_club_record_matches`
- `verify_club_record_guest_invite_code`
- `join_club_record_event_guest_by_invite_code`
- `get_club_record_monthly_public_card`
- `sync_club_record_members`
- `apply_club_record_auto_assignments`
- `create_club_record_manual_match`
- `delete_club_record_match`
- `mark_club_record_event_assignment_dirty`
- `refresh_club_record_progress_for_event`

## RLS Principles

- 클럽 소속이 아니면 어떤 데이터도 읽지 못함
- 비활성 멤버(`is_active=false`)는 과거 참가 row가 남아 있어도 멤버/경기 참가자 helper를 통과하지 못함
- 랭킹/운영 메모는 운영진/관리자만
- 클럽 회원 랭킹 동기화는 운영진/관리자만 가능하며, 활성 `owner/manager/member`만 추가하고 `guest`/비활성 멤버는 제외한다.
- 회원은 본인 경기만
- 게스트는 초대된 범위만
- 월간 카드/히스토리는 direct table select보다 RPC 우선
- 참가자 목록과 선수 구성은 민감 필드/내부 식별자를 포함하므로 direct table select를 열지 않고 RPC/DTO로 제한
- 이벤트 슬롯 overview는 운영진/관리자 또는 해당 이벤트 참가자만 조회한다.
- 취소/삭제된 이벤트와 취소된 경기는 멤버/게스트용 direct select 및 RPC 응답에서 제외하고, 운영진/관리자 관리 경로만 예외로 둔다.
- 참가자 RPC에서 `ranking_position`은 운영진/관리자에게만 내려주며, `club_member_id`/`guest_profile_id`는 운영진/관리자 또는 본인 식별에 필요한 경우에만 내려준다.

## Sensitive Fields

- 운영 메모
- 게스트 내부 식별자
- 내부 participant reference
- 랭킹 위치

이 필드들은 DTO/RPC에서 가공 후 노출하는 방향이 안전하다.
