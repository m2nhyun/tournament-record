import { getSupabaseClient } from "@/lib/supabase/client";
import { requireUser } from "@/features/auth/services/auth";
import { writeAuditLog } from "@/features/matches/services/audit";
import type {
  MatchCreationData,
  MatchSummary,
  MatchDetail,
  SetScore,
} from "@/features/matches/types/match";

function buildScoreSummary(setScores: SetScore[]): string {
  return setScores.map((s) => `${s.side1}-${s.side2}`).join(", ");
}

function normalizeSetScores(value: unknown): SetScore[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const candidate = raw as Partial<SetScore>;
      const side1 =
        typeof candidate.side1 === "number" ? Math.max(0, candidate.side1) : 0;
      const side2 =
        typeof candidate.side2 === "number" ? Math.max(0, candidate.side2) : 0;
      const set =
        typeof candidate.set === "number" && candidate.set > 0
          ? candidate.set
          : index + 1;
      const gamesToWin =
        candidate.gamesToWin === 4 || candidate.gamesToWin === 6
          ? candidate.gamesToWin
          : 6;
      const side1Point =
        candidate.side1Point === "0" ||
        candidate.side1Point === "15" ||
        candidate.side1Point === "30" ||
        candidate.side1Point === "40" ||
        candidate.side1Point === "AD"
          ? candidate.side1Point
          : undefined;
      const side2Point =
        candidate.side2Point === "0" ||
        candidate.side2Point === "15" ||
        candidate.side2Point === "30" ||
        candidate.side2Point === "40" ||
        candidate.side2Point === "AD"
          ? candidate.side2Point
          : undefined;
      const normalized: SetScore = {
        set,
        side1,
        side2,
        gamesToWin,
        side1Point,
        side2Point,
      };

      return normalized;
    })
    .filter((score): score is SetScore => score !== null);
}

export async function createMatch(
  clubId: string,
  data: MatchCreationData,
): Promise<string> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error(
      "게스트는 경기 기록을 저장할 수 없습니다. 카카오/이메일 로그인 후 이용해주세요.",
    );
  }

  const { data: match, error: matchError } = await getSupabaseClient()
    .from("matches")
    .insert({
      club_id: clubId,
      match_type: data.matchType,
      status: "confirmed",
      played_at: data.playedAt,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (matchError || !match) {
    throw matchError ?? new Error("경기 생성에 실패했습니다.");
  }

  const playerRows = data.players.map((p) => ({
    match_id: match.id,
    club_member_id: p.clubMemberId,
    side: p.side,
    position: p.position,
  }));

  const { error: playerError } = await getSupabaseClient()
    .from("match_players")
    .insert(playerRows);

  if (playerError) throw playerError;

  const scoreSummary = buildScoreSummary(data.setScores);

  const { error: resultError } = await getSupabaseClient()
    .from("match_results")
    .insert({
      match_id: match.id,
      score_summary: scoreSummary,
      set_scores: data.setScores,
      submitted_by: user.id,
    });

  if (resultError) throw resultError;

  await writeAuditLog({
    clubId,
    actorUserId: user.id,
    action: "match.created",
    entityType: "match",
    entityId: match.id,
    payload: { matchType: data.matchType, scoreSummary },
  });

  return match.id;
}

type MatchRow = {
  id: string;
  club_id: string;
  match_type: string;
  status: string;
  played_at: string;
  created_at: string;
  match_results:
    | { score_summary: string; set_scores?: unknown }
    | { score_summary: string; set_scores?: unknown }[]
    | null;
  match_players: {
    side: number;
    club_members:
      | { nickname: string; user_id: string }
      | { nickname: string; user_id: string }[]
      | null;
  }[];
};

function normalizeClubMember(
  cm:
    | { nickname: string; user_id: string }
    | { nickname: string; user_id: string }[]
    | null,
): { nickname: string; userId: string | null } {
  if (!cm) return { nickname: "?", userId: null };
  if (Array.isArray(cm)) {
    return {
      nickname: cm[0]?.nickname ?? "?",
      userId: cm[0]?.user_id ?? null,
    };
  }
  return { nickname: cm.nickname, userId: cm.user_id };
}

function normalizeNickname(
  cm: { nickname: string } | { nickname: string }[] | null,
): string {
  if (!cm) return "?";
  if (Array.isArray(cm)) return cm[0]?.nickname ?? "?";
  return cm.nickname;
}

function pickFirstResult<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function listClubMatches(clubId: string): Promise<MatchSummary[]> {
  const user = await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("matches")
    .select(
      "id,club_id,match_type,status,played_at,created_at,match_results(score_summary,set_scores),match_players(side,club_members(nickname,user_id))",
    )
    .eq("club_id", clubId)
    .order("played_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as MatchRow[]).map((row) => {
    const firstResult = pickFirstResult(row.match_results);
    const setScores = normalizeSetScores(firstResult?.set_scores);
    const scoreSummary =
      firstResult?.score_summary ??
      (setScores.length > 0 ? buildScoreSummary(setScores) : "");

    const side1Players: string[] = [];
    const side2Players: string[] = [];
    let currentUserSide: 1 | 2 | null = null;

    for (const mp of row.match_players) {
      const member = normalizeClubMember(mp.club_members);
      const name = member.nickname;
      if (mp.side === 1) side1Players.push(name);
      else side2Players.push(name);
      if (member.userId === user.id) {
        currentUserSide = mp.side === 1 ? 1 : 2;
      }
    }

    return {
      id: row.id,
      clubId: row.club_id,
      matchType: row.match_type as MatchSummary["matchType"],
      status: row.status as MatchSummary["status"],
      playedAt: row.played_at,
      scoreSummary,
      setScores,
      side1Players,
      side2Players,
      currentUserSide,
      createdAt: row.created_at,
    };
  });
}

type MatchDetailRow = {
  id: string;
  club_id: string;
  match_type: string;
  status: string;
  played_at: string;
  created_by: string;
  created_at: string;
  match_results:
    | {
        score_summary: string;
        set_scores?: unknown;
        submitted_by: string;
      }
    | {
        score_summary: string;
        set_scores?: unknown;
        submitted_by: string;
      }[]
    | null;
  match_players: {
    side: number;
    position: number;
    club_member_id: string;
    club_members: { nickname: string } | { nickname: string }[] | null;
  }[];
};

export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("matches")
    .select(
      "id,club_id,match_type,status,played_at,created_by,created_at,match_results(score_summary,set_scores,submitted_by),match_players(side,position,club_member_id,club_members(nickname))",
    )
    .eq("id", matchId)
    .single();

  if (error || !data) {
    throw error ?? new Error("경기를 찾을 수 없습니다.");
  }

  const row = data as MatchDetailRow;
  const firstResult = pickFirstResult(row.match_results);
  const result =
    firstResult
      ? {
          scoreSummary: firstResult.score_summary,
          setScores: normalizeSetScores(firstResult.set_scores),
          submittedBy: firstResult.submitted_by,
        }
      : null;

  const players = row.match_players.map((mp) => ({
    side: mp.side as 1 | 2,
    position: mp.position,
    nickname: normalizeNickname(mp.club_members),
    clubMemberId: mp.club_member_id,
  }));

  return {
    id: row.id,
    clubId: row.club_id,
    matchType: row.match_type as MatchDetail["matchType"],
    status: row.status as MatchDetail["status"],
    playedAt: row.played_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    result,
    players,
  };
}
