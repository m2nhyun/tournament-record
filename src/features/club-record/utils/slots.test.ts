import { describe, expect, it } from "vitest";

import { buildClubRecordEventSlots } from "./slots";

describe("club-record/slots", () => {
  it("30분 단위와 코트 수에 맞춰 슬롯을 생성한다", () => {
    const slots = buildClubRecordEventSlots({
      eventId: "event-1",
      startsAt: "2026-05-06T19:00:00.000+09:00",
      endsAt: "2026-05-06T21:00:00.000+09:00",
      courtCount: 2,
    });

    expect(slots).toHaveLength(8);
    expect(slots[0]).toMatchObject({
      event_id: "event-1",
      court_number: 1,
      slot_order: 1,
      starts_at: "2026-05-06T10:00:00.000Z",
      ends_at: "2026-05-06T10:30:00.000Z",
    });
    expect(slots[1]).toMatchObject({
      court_number: 2,
      slot_order: 1,
    });
    expect(slots[2]).toMatchObject({
      court_number: 1,
      slot_order: 2,
      starts_at: "2026-05-06T10:30:00.000Z",
      ends_at: "2026-05-06T11:00:00.000Z",
    });
    expect(slots[7]).toMatchObject({
      court_number: 2,
      slot_order: 4,
      starts_at: "2026-05-06T11:30:00.000Z",
      ends_at: "2026-05-06T12:00:00.000Z",
    });
  });

  it("30분 단위가 아니면 에러를 던진다", () => {
    expect(() =>
      buildClubRecordEventSlots({
        eventId: "event-1",
        startsAt: "2026-05-06T19:15:00.000+09:00",
        endsAt: "2026-05-06T21:00:00.000+09:00",
        courtCount: 1,
      }),
    ).toThrow("30분 단위");
  });

  it("종료 시간이 시작 시간보다 늦지 않으면 에러를 던진다", () => {
    expect(() =>
      buildClubRecordEventSlots({
        eventId: "event-1",
        startsAt: "2026-05-06T19:00:00.000+09:00",
        endsAt: "2026-05-06T19:00:00.000+09:00",
        courtCount: 1,
      }),
    ).toThrow("종료 시간은 시작 시간보다 늦어야 합니다.");
  });
});
