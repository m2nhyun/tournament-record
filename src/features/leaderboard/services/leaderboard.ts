import { getSupabaseClient } from "@/lib/supabase/client";
import { requireUser } from "@/features/auth/services/auth";
import type { LeaderboardEntry } from "@/features/leaderboard/types/leaderboard";

type MatchRow = {
  id: string;
  status: string;
  match_results:
    | {
        score_summary: string;
        set_scores: { set: number; side1: number; side2: number }[];
      }[]
    | null;
  match_players: {
    side: number;
    club_member_id: string;
    club_members: { nickname: string } | { nickname: string }[] | null;
  }[];
};

function normalizeNickname(
  cm: { nickname: string } | { nickname: string }[] | null,
): string {
  if (!cm) return "?";
  if (Array.isArray(cm)) return cm[0]?.nickname ?? "?";
  return cm.nickname;
}

function determineWinningSide(
  setScores: { side1: number; side2: number }[],
): 1 | 2 | null {
  let side1Wins = 0;
  let side2Wins = 0;
  for (const s of setScores) {
    if (s.side1 > s.side2) side1Wins++;
    else if (s.side2 > s.side1) side2Wins++;
  }
  if (side1Wins > side2Wins) return 1;
  if (side2Wins > side1Wins) return 2;
  return null;
}

export async function getClubLeaderboard(
  clubId: string,
): Promise<LeaderboardEntry[]> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("matches")
    .select(
      "id,status,match_results(score_summary,set_scores),match_players(side,club_member_id,club_members(nickname))",
    )
    .eq("club_id", clubId)
    .in("status", ["submitted", "confirmed"]);

  if (error) throw error;

  const stats = new Map<
    string,
    { nickname: string; wins: number; losses: number; total: number }
  >();

  for (const row of (data ?? []) as MatchRow[]) {
    const results = row.match_results;
    if (!results || results.length === 0) continue;

    const setScores = results[0].set_scores;
    if (!setScores || setScores.length === 0) continue;

    const winningSide = determineWinningSide(setScores);
    if (winningSide === null) continue;

    for (const mp of row.match_players) {
      const key = mp.club_member_id;
      const nickname = normalizeNickname(mp.club_members);

      if (!stats.has(key)) {
        stats.set(key, { nickname, wins: 0, losses: 0, total: 0 });
      }

      const entry = stats.get(key)!;
      entry.total++;
      if (mp.side === winningSide) {
        entry.wins++;
      } else {
        entry.losses++;
      }
    }
  }

  const entries: LeaderboardEntry[] = Array.from(stats.entries()).map(
    ([id, s]) => ({
      clubMemberId: id,
      nickname: s.nickname,
      wins: s.wins,
      losses: s.losses,
      totalMatches: s.total,
      winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
    }),
  );

  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.winRate - a.winRate;
  });

  return entries;
}
