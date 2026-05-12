import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordHistoryEntry,
  ClubRecordMonthlyCardEntry,
} from "@/features/club-record/types/history";
import { mapClubRecordError } from "@/features/club-record/services/errors";
import {
  requireClubRecordAdminAccess,
  requireClubRecordCapability,
  requireClubRecordMemberAccess,
} from "@/features/club-record/services/access";

type HistoryRow = {
  match_id: string;
  event_id: string;
  event_date: string;
  score_text: string;
  result: ClubRecordHistoryEntry["result"];
  team_names: string[] | null;
  partner_names: string[] | null;
  opponent_names: string[] | null;
};

type MonthlyPublicCardRow = {
  club_member_id: string;
  nickname: string;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  win_rate: number | null;
};

function toHistoryEntry(row: HistoryRow): ClubRecordHistoryEntry {
  return {
    matchId: row.match_id,
    eventId: row.event_id,
    eventDate: row.event_date,
    scoreText: row.score_text,
    result: row.result,
    teamNames: row.team_names ?? row.partner_names ?? [],
    partnerNames: row.partner_names ?? [],
    opponentNames: row.opponent_names ?? [],
  };
}

export async function getMyClubRecordHistory(
  clubId: string,
): Promise<ClubRecordHistoryEntry[]> {
  await requireUser();
  await requireClubRecordMemberAccess(clubId, "본인 히스토리는 회원 이상만 조회할 수 있습니다.");

  const { data, error } = await getSupabaseClient().rpc(
    "get_my_club_record_history",
    {
      p_club_id: clubId,
    },
  );

  if (error) throw mapClubRecordError(error);

  return ((data ?? []) as HistoryRow[]).map(toHistoryEntry);
}

export async function getClubRecordMemberHistory(
  clubId: string,
  targetClubMemberId: string,
): Promise<ClubRecordHistoryEntry[]> {
  await requireUser();
  await requireClubRecordAdminAccess(
    clubId,
    "타인 히스토리는 운영진 이상만 조회할 수 있습니다.",
  );

  const { data, error } = await getSupabaseClient().rpc(
    "get_club_record_member_history",
    {
      p_club_id: clubId,
      p_target_club_member_id: targetClubMemberId,
    },
  );

  if (error) throw mapClubRecordError(error);

  return ((data ?? []) as HistoryRow[]).map(toHistoryEntry);
}

export async function getMonthlyPublicCard(
  clubId: string,
  monthStart: string,
): Promise<ClubRecordMonthlyCardEntry[]> {
  await requireUser();
  await requireClubRecordCapability(
    clubId,
    "canViewMonthlyCard",
    "월간 카드는 조회할 수 없습니다.",
  );

  const { data, error } = await getSupabaseClient().rpc(
    "get_club_record_monthly_public_card",
    {
      p_club_id: clubId,
      p_month_start: monthStart,
    },
  );

  if (error) throw mapClubRecordError(error);

  return ((data ?? []) as MonthlyPublicCardRow[]).map((row) => ({
    clubMemberId: String(row.club_member_id),
    nickname: String(row.nickname),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    draws: Number(row.draws ?? 0),
    winRate: Number(row.win_rate ?? 0),
  }));
}
