import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordMatchResult,
  ClubRecordResultInput,
} from "@/features/club-record/types/match";
import { mapClubRecordError } from "@/features/club-record/services/errors";
import { parseClubRecordScoreText } from "@/features/club-record/utils/score";

type ResultRpcRow = {
  match_id: string;
  score_text: string;
  is_draw: boolean;
  winning_side: 1 | 2 | null;
  losing_side: 1 | 2 | null;
  created_at: string;
};

function toClubRecordMatchResult(row: ResultRpcRow): ClubRecordMatchResult {
  return {
    matchId: row.match_id,
    scoreText: row.score_text,
    isDraw: row.is_draw,
    winningSide: row.winning_side,
    losingSide: row.losing_side,
    enteredAt: row.created_at,
  };
}

export async function submitMatchResult(
  matchId: string,
  input: ClubRecordResultInput,
): Promise<ClubRecordMatchResult> {
  await requireUser();

  const parsed = parseClubRecordScoreText(input.scoreText);

  const { data, error } = await getSupabaseClient().rpc(
    "submit_club_record_match_result",
    {
      p_match_id: matchId,
      p_score_text: parsed.normalizedScoreText,
      p_is_draw: parsed.isDraw,
      p_winning_side: parsed.winningSide,
      p_losing_side: parsed.losingSide,
    },
  );

  if (error) throw mapClubRecordError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("club record 결과 저장 결과를 찾을 수 없습니다.");
  }

  return toClubRecordMatchResult(row as ResultRpcRow);
}

export async function updateMatchResult(
  matchId: string,
  input: ClubRecordResultInput,
): Promise<ClubRecordMatchResult> {
  await requireUser();

  const parsed = parseClubRecordScoreText(input.scoreText);

  const { data, error } = await getSupabaseClient().rpc(
    "update_club_record_match_result",
    {
      p_match_id: matchId,
      p_score_text: parsed.normalizedScoreText,
      p_is_draw: parsed.isDraw,
      p_winning_side: parsed.winningSide,
      p_losing_side: parsed.losingSide,
    },
  );

  if (error) throw mapClubRecordError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("club record 결과 수정 결과를 찾을 수 없습니다.");
  }

  return toClubRecordMatchResult(row as ResultRpcRow);
}
