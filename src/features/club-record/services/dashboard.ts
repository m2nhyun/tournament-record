import { getClubRecordAccessContext } from "@/features/club-record/services/access";
import { getClubRecordEvents } from "@/features/club-record/services/events";
import { getMonthlyPublicCard } from "@/features/club-record/services/history";
import type {
  ClubRecordDashboardData,
  ClubRecordDashboardEventSummary,
} from "@/features/club-record/types/dashboard";
import { getMonthStartIsoDate } from "@/features/club-record/utils/date";

function toDashboardEventSummary(
  event: Awaited<ReturnType<typeof getClubRecordEvents>>[number],
): ClubRecordDashboardEventSummary {
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
  left: ClubRecordDashboardEventSummary,
  right: ClubRecordDashboardEventSummary,
) {
  return (
    new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
  );
}

export async function getClubRecordDashboardData(
  clubId: string,
  now = new Date(),
): Promise<ClubRecordDashboardData> {
  const monthStart = getMonthStartIsoDate(now);
  const access = await getClubRecordAccessContext(clubId);
  const events = await getClubRecordEvents(clubId);
  const monthlyCard = await getMonthlyPublicCard(clubId, monthStart);

  const visibleEvents = events
    .filter((event) => !event.isDeleted)
    .map(toDashboardEventSummary)
    .sort(sortEventSummary);

  const nowTime = now.getTime();
  const currentEvent =
    visibleEvents.find((event) => {
      const start = new Date(event.startsAt).getTime();
      const end = new Date(event.endsAt).getTime();
      return start <= nowTime && nowTime <= end;
    }) ??
    visibleEvents.find((event) => new Date(event.startsAt).getTime() >= nowTime) ??
    visibleEvents[0] ??
    null;

  const upcomingEvents = visibleEvents
    .filter((event) => event.id !== currentEvent?.id)
    .slice(0, 5);

  return {
    access,
    currentEvent,
    upcomingEvents,
    monthlyCard,
    monthStart,
  };
}
