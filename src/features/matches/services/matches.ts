import { getSupabaseClient } from "@/lib/supabase/client";
import { requireUser } from "@/features/auth/services/auth";
import type { ClubRole } from "@/features/clubs/types/club";
import { writeAuditLog } from "@/features/matches/services/audit";
import { resolveMatchStatus } from "@/features/matches/utils/match-status";
import type {
  MatchConfirmation,
  MatchConfirmationDecision,
  MatchCreationData,
  MatchSummary,
  MatchDetail,
  PendingMatchConfirmationSummary,
  SetScore,
} from "@/features/matches/types/match";

function buildScoreSummary(setScores: SetScore[]): string {
  return setScores.map((s) => `${s.side1}-${s.side2}`).join(", ");
}

function determineWinningSide(setScores: SetScore[]): 1 | 2 | null {
  let side1Wins = 0;
  let side2Wins = 0;

  for (const score of setScores) {
    if (score.side1 > score.side2) side1Wins += 1;
    else if (score.side2 > score.side1) side2Wins += 1;
  }

  if (side1Wins > side2Wins) return 1;
  if (side2Wins > side1Wins) return 2;
  return null;
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

async function replaceMatchConfirmations(
  matchId: string,
  players: MatchCreationData["players"],
  setScores: SetScore[],
  submitterUserId: string,
) {
  const supabase = getSupabaseClient();
  const { error: deleteConfirmationsError } = await supabase
    .from("match_confirmations")
    .delete()
    .eq("match_id", matchId);

  if (deleteConfirmationsError) throw deleteConfirmationsError;

  const { data: targetMembers, error: targetMembersError } = await supabase
    .from("club_members")
    .select("id,user_id")
    .in(
      "id",
      players.map((player) => player.clubMemberId),
    );

  if (targetMembersError) throw targetMembersError;

  const enrichedPlayers = players.map((player) => {
    const matchedMember = (targetMembers ?? []).find(
      (member) => member.id === player.clubMemberId,
    );

    return {
      ...player,
      userId: matchedMember?.user_id ?? null,
    };
  });

  const winningSide = determineWinningSide(setScores);
  const submitterSide =
    enrichedPlayers.find((player) => player.userId === submitterUserId)?.side ?? null;

  const targetPlayers = enrichedPlayers.filter((player) => {
    if (player.userId === submitterUserId) return false;
    if (winningSide !== null) return player.side !== winningSide;
    if (submitterSide !== null) return player.side !== submitterSide;
    return true;
  });

  if (targetPlayers.length === 0) return;

  const { error: insertConfirmationsError } = await supabase
    .from("match_confirmations")
    .insert(
      targetPlayers.map((player) => ({
        match_id: matchId,
        club_member_id: player.clubMemberId,
        user_id: player.userId,
        side: player.side,
        decision: "pending" as const,
      })),
    );

  if (insertConfirmationsError) throw insertConfirmationsError;
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
      status: "submitted",
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

  await replaceMatchConfirmations(match.id, data.players, data.setScores, user.id);

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

export async function updateMatch(
  matchId: string,
  data: MatchCreationData,
): Promise<string> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error(
      "게스트는 경기 기록을 수정할 수 없습니다. 카카오/이메일 로그인 후 이용해주세요.",
    );
  }

  const { data: existingMatch, error: existingMatchError } =
    await getSupabaseClient()
      .from("matches")
      .select("id,club_id")
      .eq("id", matchId)
      .single();

  if (existingMatchError || !existingMatch) {
    throw existingMatchError ?? new Error("경기를 찾을 수 없습니다.");
  }

  const { error: matchError } = await getSupabaseClient()
    .from("matches")
    .update({
      match_type: data.matchType,
      status: "submitted",
      played_at: data.playedAt,
    })
    .eq("id", matchId);

  if (matchError) throw matchError;

  const { error: deletePlayersError } = await getSupabaseClient()
    .from("match_players")
    .delete()
    .eq("match_id", matchId);

  if (deletePlayersError) throw deletePlayersError;

  const playerRows = data.players.map((player) => ({
    match_id: matchId,
    club_member_id: player.clubMemberId,
    side: player.side,
    position: player.position,
  }));

  const { error: playerError } = await getSupabaseClient()
    .from("match_players")
    .insert(playerRows);

  if (playerError) throw playerError;

  const scoreSummary = buildScoreSummary(data.setScores);

  const { error: resultError } = await getSupabaseClient()
    .from("match_results")
    .upsert(
      {
        match_id: matchId,
        score_summary: scoreSummary,
        set_scores: data.setScores,
        submitted_by: user.id,
      },
      { onConflict: "match_id" },
    );

  if (resultError) throw resultError;

  const { error: resetConfirmationError } = await getSupabaseClient()
    .from("match_results")
    .update({
      confirmed_by: null,
      confirmed_at: null,
    })
    .eq("match_id", matchId);

  if (resetConfirmationError) throw resetConfirmationError;

  await replaceMatchConfirmations(matchId, data.players, data.setScores, user.id);

  await writeAuditLog({
    clubId: existingMatch.club_id,
    actorUserId: user.id,
    action: "match.updated",
    entityType: "match",
    entityId: matchId,
    payload: { matchType: data.matchType, scoreSummary },
  });

  return matchId;
}

async function updateMatchConfirmationDecision(
  matchId: string,
  decision: MatchConfirmationDecision,
): Promise<{ confirmed: boolean; pendingCount: number }> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error("게스트는 경기 확인을 처리할 수 없습니다.");
  }

  const supabase = getSupabaseClient();
  const { data: confirmation, error: confirmationError } = await supabase
    .from("match_confirmations")
    .select("id,match_id,club_member_id,decision")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .single();

  if (confirmationError || !confirmation) {
    throw confirmationError ?? new Error("처리할 경기 확인 요청을 찾을 수 없습니다.");
  }

  if (confirmation.decision !== "pending") {
    throw new Error("이미 처리된 경기 확인 요청입니다.");
  }

  const decidedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("match_confirmations")
    .update({
      decision,
      decided_at: decidedAt,
    })
    .eq("id", confirmation.id);

  if (updateError) throw updateError;

  let confirmed = false;
  let pendingCount = 0;
  if (decision === "approved") {
    const { data: remainingConfirmations, error: remainingConfirmationsError } =
      await supabase
        .from("match_confirmations")
        .select("decision")
        .eq("match_id", matchId);

    if (remainingConfirmationsError) throw remainingConfirmationsError;

    pendingCount = (remainingConfirmations ?? []).filter(
      (row) => row.decision === "pending",
    ).length;

    const allApproved =
      (remainingConfirmations ?? []).length > 0 &&
      (remainingConfirmations ?? []).every((row) => row.decision === "approved");

    if (allApproved) {
      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({ status: "confirmed" })
        .eq("id", matchId);

      if (matchUpdateError) throw matchUpdateError;

      const { error: resultUpdateError } = await supabase
        .from("match_results")
        .update({
          confirmed_by: user.id,
          confirmed_at: decidedAt,
        })
        .eq("match_id", matchId);

      if (resultUpdateError) throw resultUpdateError;
      confirmed = true;
    } else {
      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({ status: "submitted" })
        .eq("id", matchId);

      if (matchUpdateError) throw matchUpdateError;
    }
  } else {
    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({ status: "disputed" })
      .eq("id", matchId);

    if (matchUpdateError) throw matchUpdateError;
  }

  const { data: matchRow, error: matchRowError } = await supabase
    .from("matches")
    .select("club_id")
    .eq("id", matchId)
    .single();

  if (matchRowError || !matchRow) {
    throw matchRowError ?? new Error("경기 정보를 찾을 수 없습니다.");
  }

  await writeAuditLog({
    clubId: matchRow.club_id,
    actorUserId: user.id,
    action: decision === "approved" ? "match.confirmed" : "match.disputed",
    entityType: "match",
    entityId: matchId,
    payload: { confirmationId: confirmation.id, clubMemberId: confirmation.club_member_id },
  });

  return { confirmed, pendingCount };
}

export async function approveMatch(
  matchId: string,
): Promise<{ confirmed: boolean; pendingCount: number }> {
  return updateMatchConfirmationDecision(matchId, "approved");
}

export async function rejectMatch(
  matchId: string,
): Promise<{ confirmed: boolean; pendingCount: number }> {
  return updateMatchConfirmationDecision(matchId, "rejected");
}

export async function deleteMatch(matchId: string): Promise<void> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error(
      "게스트는 경기 기록을 삭제할 수 없습니다. 카카오/이메일 로그인 후 이용해주세요.",
    );
  }

  const { data: existingMatch, error: existingMatchError } =
    await getSupabaseClient()
      .from("matches")
      .select("id,club_id")
      .eq("id", matchId)
      .single();

  if (existingMatchError || !existingMatch) {
    throw existingMatchError ?? new Error("경기를 찾을 수 없습니다.");
  }

  const { error: deleteError } = await getSupabaseClient()
    .from("matches")
    .delete()
    .eq("id", matchId);

  if (deleteError) throw deleteError;

  await writeAuditLog({
    clubId: existingMatch.club_id,
    actorUserId: user.id,
    action: "match.deleted",
    entityType: "match",
    entityId: matchId,
  });
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
  match_confirmations: {
    decision: MatchConfirmationDecision;
  }[];
};

type PendingConfirmationRow = {
  id: string;
  match_id: string;
  matches:
    | {
        id: string;
        club_id: string;
        played_at: string;
        match_type: string;
        status: string;
      }[]
    | null;
};

function normalizeClubMember(
  cm:
    | { nickname: string; user_id: string | null }
    | { nickname: string; user_id: string | null }[]
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
      "id,club_id,match_type,status,played_at,created_at,match_results(score_summary,set_scores),match_players(side,club_members(nickname,user_id)),match_confirmations(decision)",
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
      status: resolveMatchStatus(
        row.status as MatchSummary["status"],
        row.match_confirmations ?? [],
      ),
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

export async function listPendingMatchConfirmations(
  clubId: string,
): Promise<PendingMatchConfirmationSummary[]> {
  const user = await requireUser();
  if (user.is_anonymous) {
    return [];
  }

  const { data, error } = await getSupabaseClient()
    .from("match_confirmations")
    .select(
      "id,match_id,matches!inner(id,club_id,played_at,match_type,status)",
    )
    .eq("user_id", user.id)
    .eq("decision", "pending")
    .eq("matches.club_id", clubId)
    .order("played_at", { ascending: false, referencedTable: "matches" });

  if (error) throw error;

  return ((data ?? []) as PendingConfirmationRow[])
    .map((row) => ({
      ...row,
      matches: Array.isArray(row.matches) ? row.matches[0] ?? null : row.matches,
    }))
    .map((row) => ({
      id: row.id,
      matchId: row.match_id,
      matchType: row.matches?.match_type as PendingMatchConfirmationSummary["matchType"],
      matchStatus: row.matches?.status as PendingMatchConfirmationSummary["matchStatus"],
      playedAt: row.matches?.played_at ?? new Date().toISOString(),
    }));
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
        confirmed_by: string | null;
        confirmed_at: string | null;
      }
    | {
        score_summary: string;
        set_scores?: unknown;
        submitted_by: string;
        confirmed_by: string | null;
        confirmed_at: string | null;
      }[]
    | null;
  match_confirmations: {
    id: string;
    side: number;
    decision: MatchConfirmationDecision;
    decided_at: string | null;
    user_id: string | null;
    club_member_id: string;
    club_members:
      | { nickname: string; user_id: string | null }
      | { nickname: string; user_id: string | null }[]
      | null;
  }[];
  match_players: {
    side: number;
    position: number;
    club_member_id: string;
    club_members:
      | { nickname: string; user_id: string | null }
      | { nickname: string; user_id: string | null }[]
      | null;
  }[];
};

export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  const user = await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("matches")
    .select(
      "id,club_id,match_type,status,played_at,created_by,created_at,match_results(score_summary,set_scores,submitted_by,confirmed_by,confirmed_at),match_confirmations(id,side,decision,decided_at,user_id,club_member_id,club_members(nickname,user_id)),match_players(side,position,club_member_id,club_members(nickname,user_id))",
    )
    .eq("id", matchId)
    .single();

  if (error || !data) {
    throw error ?? new Error("경기를 찾을 수 없습니다.");
  }

  const row = data as MatchDetailRow;
  const { data: membership, error: membershipError } = await getSupabaseClient()
    .from("club_members")
    .select("role")
    .eq("club_id", row.club_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (membershipError || !membership) {
    throw membershipError ?? new Error("해당 클럽의 멤버가 아닙니다.");
  }

  const firstResult = pickFirstResult(row.match_results);
  const result =
    firstResult
      ? {
          scoreSummary: firstResult.score_summary,
          setScores: normalizeSetScores(firstResult.set_scores),
          submittedBy: firstResult.submitted_by,
          confirmedBy: firstResult.confirmed_by,
          confirmedAt: firstResult.confirmed_at,
        }
      : null;
  const myRole = membership.role as ClubRole;
  const canEdit =
    row.created_by === user.id || myRole === "owner" || myRole === "manager";

  let currentUserSide: 1 | 2 | null = null;
  const players = row.match_players.map((mp) => {
    const member = normalizeClubMember(mp.club_members);
    if (member.userId === user.id) {
      currentUserSide = mp.side as 1 | 2;
    }
    return {
      side: mp.side as 1 | 2,
      position: mp.position,
      nickname: member.nickname,
      clubMemberId: mp.club_member_id,
    };
  });

  const confirmations: MatchConfirmation[] = row.match_confirmations.map((confirmation) => {
    const member = normalizeClubMember(confirmation.club_members);
    return {
      id: confirmation.id,
      clubMemberId: confirmation.club_member_id,
      nickname: member.nickname,
      side: confirmation.side as 1 | 2,
      userId: confirmation.user_id,
      decision: confirmation.decision,
      decidedAt: confirmation.decided_at,
    };
  });

  const myConfirmation = confirmations.find(
    (confirmation) =>
      confirmation.userId === user.id && confirmation.decision === "pending",
  );
  const resolvedStatus = resolveMatchStatus(
    row.status as MatchDetail["status"],
    confirmations,
  );

  return {
    id: row.id,
    clubId: row.club_id,
    matchType: row.match_type as MatchDetail["matchType"],
    status: resolvedStatus,
    playedAt: row.played_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    canEdit,
    canApprove: Boolean(myConfirmation) && resolvedStatus === "submitted",
    canReject: Boolean(myConfirmation) && resolvedStatus === "submitted",
    currentUserSide,
    result,
    confirmations,
    players,
  };
}
