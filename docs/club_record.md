# Club Record

상세 설계는 분리 문서로 이동했다. 구현 시에는 아래 순서로 읽는다.

## Entry Point

- [Club Record Master](./club-record/README.md)
- [Handoff For Next Worker](./club-record/07-handoff.md)

## Fast Links

- [Rules](./club-record/01-rules.md)
- [Domain](./club-record/02-domain.md)
- [Schema](./club-record/03-schema.md)
- [Access](./club-record/04-access.md)
- [Implementation](./club-record/05-implementation.md)
- [Checklist](./club-record/06-checklist.md)
- [Handoff](./club-record/07-handoff.md)
- [Review Findings](./club-record/08-review-findings.md)

## Why Split

- 한 파일에 모든 내용을 몰아넣으면 컨텍스트가 과도하게 커진다
- 구현 단계에서는 필요한 문서만 선택적으로 읽는 편이 안전하다
- 이후 자동 매칭 상세 로직, UI/UX, 실제 SQL 검증도 같은 방식으로 추가 분리한다
