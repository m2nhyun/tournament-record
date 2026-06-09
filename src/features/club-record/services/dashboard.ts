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

  let nextMatch: ClubRecordDashboardNextMatch | null = null;
  if (access.clubMemberId) {
    try {
      nextMatch = await fetchNextMatch(clubId);
    } catch (error) {
      // 새 RPC가 아직 운영 DB에 반영되지 않은 경우 등, "내 다음 경기" 카드만
      // 조용히 숨기고 나머지 대시보드 데이터는 정상 로드되게 한다.
      console.warn("[club-record] fetchNextMatch failed; hiding card.", error);
      nextMatch = null;
    }
  }

  return {
    access,
    currentEvent,
    upcomingEvents,
    monthlyCard,
    monthStart,
    nextMatch,
  };
}
