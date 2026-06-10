# QA: 24명 풀 클럽 시나리오 (full-club)

> 작성일: 2026-06-10
> 범위: club_record 도메인 end-to-end (시드 → 자동 편성 → 결과 입력 → 랭킹 갱신 → cleanup)

## 1. 시나리오 분포

- 회원 20명 (owner 1 + member 19): 여자 4 / 남자 16
- 게스트 4명 (event guest profile + 인증 사용자): 여자 2 / 남자 2
- 합계: 24명, 여자 6명 (그중 게스트 2명)
- 이벤트: 코트 4개 × 30분 슬롯 × 6라운드 = 24 슬롯
- 시드 클럽 이름: `QA Full-Club Test`
- 시드 이메일 도메인: `qa-full-club+...@tournament-record.local`
- 시드 비밀번호: `qa-full-club-pass!1` (로컬 전용)

## 2. 실행 명령

```bash
# 사전 조건
#   - Docker 실행 (npx supabase가 컨테이너 사용)
#   - npx supabase start 로 로컬 인스턴스 가동
#   - .env.local 에 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 존재
#     (운영 키여도 무방 — 실행 시 use-local-supabase.sh가 로컬 키로 override 한다)

# 풀 e2e (seed + scenario + cleanup)
npm run qa:full-club

# 개별 단계
npm run qa:full-club:seed       # 24명 + 클럽 + 이벤트 + 슬롯 + 참가자 시드
npm run qa:full-club:scenario   # vitest e2e (scripts/qa/full-club/scenario.e2e.test.ts)
npm run qa:full-club:cleanup    # 시드 데이터 + auth 사용자 제거

# 운영 read-only smoke (시드/cleanup 절대 안 함)
npm run qa:full-club:smoke-prod
```

`qa:full-club:scenario`는 `vitest run --config vitest.e2e.config.ts`이며 단일 fork 순차 실행이다.
`npm run test`(기본 vitest)에는 포함되지 않으므로 일반 CI/로컬 사이클을 깨지 않는다.

## 3. 자동 검증 항목 (scenario.e2e.test.ts 기준)

| # | 항목 | 검증 방식 |
|---|---|---|
| 1 | `get_club_record_event_participants` RPC가 24명 반환 | 회원 20 / 게스트 4 / 여 6 / 게스트 여 2 단언 |
| 2 | owner JWT에서 회원의 `ranking_position`이 가시 | `rankingPosition` 누락 0건 |
| 3 | `groupCode`가 A/B/C 중 하나 | sync 후 자동 분류 |
| 4 | `computeWomenMatchTarget(여 6)` === 2 | 클라이언트 함수 단위 검증 |
| 5 | `planClubRecordAutoAssignments` 결과가 6매치 이상 + side 1/2 모두 등장 | 알고리즘 산출물 모양 검증 |
| 6 | `apply_club_record_auto_assignments` RPC가 동일 개수의 매치 row 생성 | 알고리즘 → DB 반영 |
| 7 | 자동 편성 결과에 all-female quartet ≥ 2 | gender bonus 동작 확인 |
| 8 | `submit_club_record_match_result`로 매치 참가 회원이 결과 입력 → status=`confirmed` | 점수: `6-4` |
| 9 | `update_club_record_match_result`로 owner가 무승부 갱신 → status=`confirmed`, `is_draw=true`, `winning_side/losing_side=null` | 점수: `6-6` |
| 10 | confirmed 자동매치 존재 시 `apply_club_record_auto_assignments` 재호출 차단 | RPC 에러 메시지 매칭 |
| 11 | 매치에 참가하지 않은 회원이 결과 제출 시도 → 거절 | RPC 에러 메시지 매칭 |
| 12 | 비회원(게스트 인증)으로 `club_record_event_participants` 직접 insert 시도 → RLS 차단 | error 매칭 |
| 13 | `club_record_members.match_count` 결과 입력 후 양수 | stats 갱신 확인 |
| 14 | event status가 `open`/`in_progress`/`completed` 중 하나로 전환 | `refresh_club_record_event_status` 호출 후 |
| 15 | `parseClubRecordScoreText` 유효/비정상 패턴 처리 | 단위 함수 검증 |

추가 단위 spec: `src/features/club-record/utils/full-club-scenario.test.ts`
- 24명 분포에서 `computeWomenMatchTarget=2`
- 코트 부족 시 (1코트 × 1라운드) 1매치만 계획
- 4코트 × 3라운드 = 12매치 환경에서 같은 팀 페어 0건 반복

## 4. 발견 사항 / 제품 규칙 확인

- club_record 매치 상태는 `pending_result | confirmed | cancelled` 만 사용한다. 일반 `matches` 도메인의 `submitted/confirmed/disputed`와 분리된다.
- 결과 입력은 다음 두 경로 모두 정상 동작:
  - 매치 참가 회원이 `submit_club_record_match_result` 호출
  - owner/manager가 `update_club_record_match_result`로 직접 입력/수정
- `apply_club_record_auto_assignments`는 confirmed 자동매치가 한 건이라도 있으면 재실행을 거부한다. 자동 편성을 다시 돌리려면 운영자가 결과를 먼저 정리해야 한다.
- `prevent_club_record_confirmed_match_delete` trigger 때문에 confirmed 매치는 직접 delete 불가. cleanup 스크립트는 delete 전에 매치 status를 `cancelled`로 update해서 우회한다.
- `validate_club_record_event_participant` trigger 덕분에 다른 클럽 회원/게스트가 이벤트 참가자로 끼어드는 경우 RLS와 별개로 거부된다.

## 5. 위험 / 운영 메모

- 시드는 **반드시 로컬 supabase**에서만 동작해야 한다. `use-local-supabase.sh`가 `npx supabase status -o json`을 기반으로 URL/키를 로컬로 강제 override한다.
- `smoke-prod.mjs`는 service_role 키를 사용하지만 **모든 호출이 read-only**다 (`select`만, INSERT/UPDATE/DELETE 없음). 운영 URL이 아닐 경우 즉시 종료한다.
- `.qa-state.json`은 `.gitignore`에 포함되어 있다. 시드/시나리오 사이 상태 전달 용도.
- 시드 비밀번호는 로컬 인스턴스 전용이라 운영에서 사용해선 안 된다.

## 6. 재실행 / 회귀 점검

문제 발생 시:
1. `npm run qa:full-club:cleanup` — 잔존 데이터 제거.
2. `docker exec supabase_db_tournament-record psql -U postgres -d postgres -tAc "SELECT count(*) FROM clubs"`로 0 확인.
3. 시나리오만 다시 돌릴 때는 시드부터 재실행해야 한다 (matches가 confirmed로 잠겨 있어 재편성이 차단됨).

## 7. 후속 후보

- 일반 `matches` 도메인 (submitted → confirmed/disputed)도 같은 시나리오에 묶기.
- club_record 게스트 초대 코드(`club_record_guest_invites`) + `join_club_record_event_guest_by_invite_code` 흐름까지 e2e에 포함.
- 4의 배수 안 맞을 때 (예: 23명) 자동 편성 동작 회귀 케이스.
