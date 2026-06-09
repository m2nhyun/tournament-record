import { getSupabaseClient } from "@/lib/supabase/client";
import { getClubRecordAccessContext } from "@/features/club-record/services/access";
import { mapClubRecordError } from "@/features/club-record/services/errors";
import { getClubRecordEvents } from "@/features/club-record/services/events";
import { getMonthlyPublicCard } from "@/features/club-record/services/history";
import type {
  ClubRecordDashboardData,
  ClubRecordDashboardNextMatch,
} from "@/features/club-record/types/dashboard";
import { getMonthStartIsoDate } from "@/features/club-record/utils/date";
import { selectDashboardEvents } from "@/features/club-record/utils/dashboard-events";

type NextMatchRow = {
  match_id: string;
  event_id: string;
  event_title: string | null;
  slot_starts_at: string;
  slot_ends_at: string;
  court_number: number;
  my_side: number;
  team_one_names: string[] | null;
  team_two_names: string[] | null;
};

async function fetchNextMatch(
  clubId: string,
): Promise<ClubRecordDashboardNextMatch | null> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_my_next_club_record_match",
    { p_club_id: clubId },
  );

  if (error) throw mapClubRecordError(error);

  const rows = (data ?? []) as NextMatchRow[];
  const row = rows[0];
  if (!row) return null;

  return {
    matchId: row.match_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    slotStartsAt: row.slot_starts_at,
    slotEndsAt: row.slot_ends_at,
    courtNumber: row.court_number,
    mySide: row.my_side === 2 ? 2 : 1,
    teamOneNames: row.team_one_names ?? [],
    teamTwoNames: row.team_two_names ?? [],
  };
}

export async function getClubRecordDashboardData(
  clubId: string,
  now = new Date(),
): Promise<ClubRecordDashboardData> {
  const monthStart = getMonthStartIsoDate(now);
  const access = await getClubRecordAccessContext(clubId);
  const events = await getClubRecordEvents(clubId);
  const monthlyCard = await getMonthlyPublicCard(clubId, monthStart);
  const { currentEvent, upcomingEvents } = selectDashboardEvents(events, now);

  const nextMatch = access.clubMemberId ? await fetchNextMatch(clubId) : null;

  return {
    access,
    currentEvent,
    upcomingEvents,
    monthlyCard,
    monthStart,
    nextMatch,
  };
}
