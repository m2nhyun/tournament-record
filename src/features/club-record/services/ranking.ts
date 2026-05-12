import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordMember,
  ClubRecordRankingMoveInput,
} from "@/features/club-record/types/member";
import { mapClubRecordError } from "@/features/club-record/services/errors";
import {
  requireClubRecordAdminAccess,
} from "@/features/club-record/services/access";

type ClubMemberRelation =
  | { nickname: string | null }
  | { nickname: string | null }[]
  | null;

type RankingRow = {
  id: string;
  club_id: string;
  club_member_id: string;
  ranking_position: number;
  group_code: ClubRecordMember["groupCode"];
  attendance_count: number;
  match_count: number;
  joined_on: string | null;
  operator_note: string | null;
  club_member: ClubMemberRelation;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toClubRecordMember(row: RankingRow): ClubRecordMember {
  const clubMember = pickOne(row.club_member);

  return {
    id: row.id,
    clubId: row.club_id,
    clubMemberId: row.club_member_id,
    nickname: clubMember?.nickname ?? "알 수 없음",
    rankingPosition: row.ranking_position,
    groupCode: row.group_code,
    attendanceCount: row.attendance_count,
    matchCount: row.match_count,
    joinedOn: row.joined_on,
    operatorNote: row.operator_note,
  };
}

export async function getClubRanking(
  clubId: string,
): Promise<ClubRecordMember[]> {
  await requireUser();
  await requireClubRecordAdminAccess(clubId, "랭킹은 운영진 이상만 조회할 수 있습니다.");

  const { data, error } = await getSupabaseClient()
    .from("club_record_members")
    .select(
      `
      id,
      club_id,
      club_member_id,
      ranking_position,
      group_code,
      attendance_count,
      match_count,
      joined_on,
      operator_note,
      club_member:club_members!club_record_members_club_member_id_fkey(nickname)
    `,
    )
    .eq("club_id", clubId)
    .order("ranking_position", { ascending: true });

  if (error) throw mapClubRecordError(error);

  return ((data ?? []) as RankingRow[]).map(toClubRecordMember);
}

export async function moveRankingPosition(
  clubId: string,
  input: ClubRecordRankingMoveInput,
): Promise<void> {
  await requireUser();
  await requireClubRecordAdminAccess(clubId, "랭킹은 운영진 이상만 수정할 수 있습니다.");

  const { error } = await getSupabaseClient().rpc("move_club_record_ranking", {
    p_club_id: clubId,
    p_club_member_id: input.clubMemberId,
    p_target_position: input.targetPosition,
  });

  if (error) throw mapClubRecordError(error);
}

export async function syncClubRecordMembers(clubId: string): Promise<number> {
  await requireUser();
  await requireClubRecordAdminAccess(
    clubId,
    "클럽 회원 랭킹은 운영진 이상만 동기화할 수 있습니다.",
  );

  const { data, error } = await getSupabaseClient().rpc(
    "sync_club_record_members",
    {
      p_club_id: clubId,
    },
  );

  if (error) throw mapClubRecordError(error);

  return Number(data ?? 0);
}
