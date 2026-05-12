import { describe, expect, it } from "vitest";

import type { ClubRecordEvent } from "@/features/club-record/types/event";
import { selectDashboardEvents } from "./dashboard-events";

function eventFixture(
  overrides: Partial<ClubRecordEvent> & Pick<ClubRecordEvent, "id" | "startsAt" | "endsAt">,
): ClubRecordEvent {
  return {
    id: overrides.id,
    clubId: "club-1",
    title: null,
    eventDate: overrides.startsAt.slice(0, 10),
    startsAt: overrides.startsAt,
    endsAt: overrides.endsAt,
    courtCount: 2,
    status: overrides.status ?? "open",
    assignmentDirty: false,
    lastAssignmentRunAt: null,
    isDeleted: overrides.isDeleted ?? false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("club-record/dashboard-events", () => {
  it("지난 이벤트만 있으면 현재/예정 이벤트로 fallback하지 않는다", () => {
    const result = selectDashboardEvents(
      [
        eventFixture({
          id: "past",
          startsAt: "2026-05-08T10:00:00.000Z",
          endsAt: "2026-05-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-05-12T10:00:00.000Z"),
    );

    expect(result.currentEvent).toBeNull();
    expect(result.upcomingEvents).toEqual([]);
  });

  it("진행 중 이벤트와 미래 이벤트만 홈 후보로 노출한다", () => {
    const result = selectDashboardEvents(
      [
        eventFixture({
          id: "past",
          startsAt: "2026-05-08T10:00:00.000Z",
          endsAt: "2026-05-08T12:00:00.000Z",
        }),
        eventFixture({
          id: "current",
          startsAt: "2026-05-12T09:00:00.000Z",
          endsAt: "2026-05-12T11:00:00.000Z",
        }),
        eventFixture({
          id: "future",
          startsAt: "2026-05-13T09:00:00.000Z",
          endsAt: "2026-05-13T11:00:00.000Z",
        }),
      ],
      new Date("2026-05-12T10:00:00.000Z"),
    );

    expect(result.currentEvent?.id).toBe("current");
    expect(result.upcomingEvents.map((event) => event.id)).toEqual(["future"]);
  });

  it("완료/취소/삭제 이벤트는 종료 전이어도 홈 후보에서 제외한다", () => {
    const result = selectDashboardEvents(
      [
        eventFixture({
          id: "completed",
          status: "completed",
          startsAt: "2026-05-12T09:00:00.000Z",
          endsAt: "2026-05-12T11:00:00.000Z",
        }),
        eventFixture({
          id: "cancelled",
          status: "cancelled",
          startsAt: "2026-05-13T09:00:00.000Z",
          endsAt: "2026-05-13T11:00:00.000Z",
        }),
        eventFixture({
          id: "deleted",
          isDeleted: true,
          startsAt: "2026-05-14T09:00:00.000Z",
          endsAt: "2026-05-14T11:00:00.000Z",
        }),
      ],
      new Date("2026-05-12T10:00:00.000Z"),
    );

    expect(result.currentEvent).toBeNull();
    expect(result.upcomingEvents).toEqual([]);
  });
});
