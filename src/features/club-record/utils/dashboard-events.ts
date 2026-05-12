import type { ClubRecordDashboardData } from "@/features/club-record/types/dashboard";
import type { ClubRecordEvent } from "@/features/club-record/types/event";

function toDashboardEventSummary(event: ClubRecordEvent) {
  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    status: event.status,
    assignmentDirty: event.assignmentDirty,
    lastAssignmentRunAt: event.lastAssignmentRunAt,
  };
}

function sortEventSummary(
  left: ReturnType<typeof toDashboardEventSummary>,
  right: ReturnType<typeof toDashboardEventSummary>,
) {
  return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
}

export function selectDashboardEvents(
  events: ClubRecordEvent[],
  now = new Date(),
): Pick<ClubRecordDashboardData, "currentEvent" | "upcomingEvents"> {
  const nowTime = now.getTime();
  const activeEvents = events
    .filter((event) => {
      if (event.isDeleted) return false;
      if (event.status === "cancelled" || event.status === "completed") return false;
      return new Date(event.endsAt).getTime() >= nowTime;
    })
    .map(toDashboardEventSummary)
    .sort(sortEventSummary);

  const currentEvent =
    activeEvents.find((event) => {
      const start = new Date(event.startsAt).getTime();
      const end = new Date(event.endsAt).getTime();
      return start <= nowTime && nowTime <= end;
    }) ?? null;

  const upcomingEvents = activeEvents
    .filter((event) => {
      if (event.id === currentEvent?.id) return false;
      return new Date(event.startsAt).getTime() >= nowTime;
    })
    .slice(0, 5);

  return { currentEvent, upcomingEvents };
}
