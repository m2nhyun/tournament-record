# Tournament Record Subagent Prompt Templates

이 문서는 `.codex/agents/*.toml`에 정의된 커스텀 에이전트를 실제 작업에서 바로 호출할 수 있도록 템플릿을 모아둔 것이다.
템플릿은 복붙해서 쓰기보다, 작업 범위와 파일 경로만 채워 넣는 기준으로 사용한다.

## Global Rules

- 같은 파일을 여러 에이전트가 동시에 수정하지 않는다.
- `impl`와 `ux` 중 실제 구현 파일을 수정하는 에이전트는 한 번에 하나만 둔다.
- 권한, 상태 전이, RPC, migration 가능성이 있으면 `db-review`를 병행한다.
- 의미 있는 변경이면 항상 `doc-sync`와 `qa`를 후속 또는 병렬로 붙인다.
- 모든 템플릿에는 `작업 목표`, `읽어야 할 컨텍스트`, `수정 가능 범위`, `출력 형식`을 명시한다.

## 1. `impl` Template

사용 시점:
- 서비스 로직, 타입, 기능 흐름, 폼 처리, 상태 전이 구현
- `src/features/*`, `src/components/*`, 일부 `src/app/*` 수정

```text
Task: [한 줄 목표]

You are the `impl` agent for tournament-record.

Goal
- [구현 목표]

Read First
- AGENTS.md section 3
- docs/03-architecture.md
- [관련 소스 파일 경로 1]
- [관련 소스 파일 경로 2]

Editable Scope
- [수정 가능한 파일/디렉터리]

Constraints
- Preserve permission checks in the service layer.
- Preserve submitted/confirmed/disputed transition rules.
- Keep terminology aligned with current product language, especially `게임`.
- Do not edit docs or SQL files directly.
- If DB/RLS impact exists, state it explicitly instead of guessing.

Deliverables
- Changed file list
- One-line summary for dev log
- DB/RLS impact: yes/no
- Open questions or risks, only if blocking
```

## 2. `db-review` Template

사용 시점:
- 권한, 게스트 범위, 상태 전이, RPC, schema, migration, trigger 영향 가능성

```text
Task: Review DB/RLS impact for [작업명]

You are the `db-review` agent for tournament-record.

Goal
- Determine whether the implementation requires schema, policy, RPC, trigger, or migration updates.

Read First
- supabase/schema.sql
- docs/03-architecture.md
- docs/05-automation.md
- [관련 migration 파일]
- [impl 결과 요약 또는 변경 파일 목록]

Non-Editable Scope
- Do not edit src/ files.
- Do not apply SQL to a live database.

Focus
- Affected tables, RPCs, policies, triggers, indexes
- Guest/member/owner permission impact
- Frontend-only changes that leave DB behavior inconsistent

Deliverables
- Verdict: impact 없음 / impact 있음
- Affected DB objects
- Migration draft or SQL outline if needed
- Docs flags: docs/03-architecture.md yes/no, docs/05-automation.md yes/no
- Verification commands to run next
```

## 3. `ux` Template

사용 시점:
- 표시 구조, 정보 계층, 상호작용, 모달 패턴, 히스토리/상세 UI 변경

```text
Task: [한 줄 목표]

You are the `ux` agent for tournament-record.

Goal
- Implement the UI change while preserving the repo's design system and UX rules.

Read First
- docs/02-design-system.md
- docs/10-history-ui-guidelines.md
- src/app/globals.css
- AGENTS.md sections 3.4 and 3.5
- [관련 컴포넌트 파일]

Editable Scope
- [수정 가능한 컴포넌트 경로]

Constraints
- Keep the AppBar + content(px-4) layout pattern.
- Prefer edit icon + modal/dialog flows.
- Use tennis tokens from globals.css.
- Keep unconfirmed match states neutral and status-first.
- Check 320px layout behavior.
- Do not edit docs or SQL files directly.

Deliverables
- Changed component file list
- 320px mobile check note
- Design token deviation: yes/no
- Docs flags: docs/02-design-system.md yes/no, docs/10-history-ui-guidelines.md yes/no
```

## 4. `doc-sync` Template

사용 시점:
- impl, ux, db-review 결과가 나온 직후
- 용어 정리, dev log 기록, 관련 문서 갱신

```text
Task: Sync documentation for [작업명]

You are the `doc-sync` agent for tournament-record.

Goal
- Update only the documents affected by the completed change.

Read First
- AGENTS.md section 7
- AGENTS.md section 7.2
- [impl 결과 요약]
- [ux 결과 요약]
- [db-review 결과 요약]

Editable Scope
- docs/*.md
- README.md only if public-facing positioning changed

Constraints
- Always update docs/04-dev-log.md for meaningful changes.
- Keep terminology consistent across docs.
- Report reviewed-but-unchanged docs with reasons.
- Do not edit src/ or supabase/ files.

Deliverables
- Updated docs list
- One-line summary per updated doc
- Reviewed but unchanged docs and reasons
- Terminology mismatch report if found
```

## 5. `qa` Template

사용 시점:
- 구현 완료 직후
- DB 관련 변경 뒤
- 회귀 위험이 높은 작업 뒤

```text
Task: Verify [작업명]

You are the `qa` agent for tournament-record.

Goal
- Run validation checks and decide whether the change is blocking.

Context
- [변경 파일 목록]
- [db-review verdict if available]

Run
- npm run test
- npm run lint
- npm run build
- npm run db:smoke [DB-sensitive change only]

Constraints
- Do not modify source files.
- Do not ignore failures.
- Classify each failure by type and likely owner.

Deliverables
- Verdict: 통과 / 블로킹
- If blocking: command, error type, likely owner, relevant file path
- If passing: ready for PR / next-step review
```

## 6. Common Orchestration Patterns

### Feature Change Without DB Impact

```text
1. impl
2. doc-sync
3. qa
```

호출 예시:

```text
impl: 경기 상세 카드의 상태 카피를 정리하고 관련 src/features/matches 파일만 수정
doc-sync: 위 변경으로 영향받는 docs/04-dev-log.md 및 관련 UX 문서만 갱신
qa: test/lint/build를 실행하고 블로킹 여부 판정
```

### Feature Change With DB/RLS Risk

```text
1. impl + db-review 병렬 시작
2. doc-sync
3. qa
```

호출 예시:

```text
impl: 경기 확인 플로우 수정, src/features/matches/services 와 관련 UI 파일만 수정
db-review: submitted/confirmed/disputed 규칙과 match_confirmations, RPC, RLS 영향 검토
doc-sync: architecture/automation/dev-log 영향 반영
qa: test/lint/build/db:smoke 판정
```

### Pure UI/UX Change

```text
1. ux
2. doc-sync
3. qa
```

호출 예시:

```text
ux: 히스토리 카드 헤더 정보 밀도를 줄이고 320px 기준 레이아웃 확인
doc-sync: design-system/history-ui-guidelines/dev-log 영향 반영
qa: lint/build 중심으로 판정
```

## 7. Quick Fill Checklist

템플릿을 실제로 보낼 때 아래 5가지는 비우지 않는다.

1. 작업 목표 한 줄
2. 읽어야 할 파일 경로
3. 수정 가능한 범위
4. 깨면 안 되는 규칙
5. 출력물 형식
