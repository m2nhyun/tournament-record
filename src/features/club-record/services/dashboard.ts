import { getClubRecordAccessContext } from "@/features/club-record/services/access";
import { getClubRecordEvents } from "@/features/club-record/services/events";
import { getMonthlyPublicCard } from "@/features/club-record/services/history";
import type {
  ClubRecordDashboardData,
} from "@/features/club-record/types/dashboard";
import { getMonthStartIsoDate } from "@/features/club-record/utils/date";
import { selectDashboardEvents } from "@/features/club-record/utils/dashboard-events";

export async function getClubRecordDashboardData(
  clubId: string,
  now = new Date(),
): Promise<ClubRecordDashboardData> {
  const monthStart = getMonthStartIsoDate(now);
  const access = await getClubRecordAccessContext(clubId);
  const events = await getClubRecordEvents(clubId);
  const monthlyCard = await getMonthlyPublicCard(clubId, monthStart);
  const { currentEvent, upcomingEvents } = selectDashboardEvents(events, now);

  return {
    access,
    currentEvent,
    upcomingEvents,
    monthlyCard,
    monthStart,
  };
}
