import { getSupabaseClient } from "@/lib/supabase/client";
import { requireUser } from "@/features/auth/services/auth";

import type {
  ClubSummary,
  ClubRole,
  ClubDetail,
  ClubMember,
} from "@/features/clubs/types/club";

type ClubEntity = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

type ClubMemberRow = {
  role: ClubRole;
  nickname: string;
  clubs: ClubEntity | ClubEntity[] | null;
};

function normalizeClub(club: ClubMemberRow["clubs"]): ClubEntity | null {
  if (!club) return null;
  if (Array.isArray(club)) return club[0] ?? null;
  return club;
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export async function listMyClubs(): Promise<ClubSummary[]> {
  const user = await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_members")
    .select("role,nickname,clubs(id,name,invite_code,created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as ClubMemberRow[])
    .map((row) => {
      const club = normalizeClub(row.clubs);
      if (!club) return null;

      return {
        id: club.id,
        name: club.name,
        inviteCode: club.invite_code,
        role: row.role,
        nickname: row.nickname,
        createdAt: club.created_at,
      } satisfies ClubSummary;
    })
    .filter((club): club is ClubSummary => club !== null);
}

export async function createClub(input: { name: string; nickname: string }) {
  const user = await requireUser();
  const inviteCode = generateInviteCode();

  const { data: club, error: clubError } = await getSupabaseClient()
    .from("clubs")
    .insert({
      name: input.name.trim(),
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (clubError || !club) {
    throw clubError ?? new Error("클럽 생성 실패");
  }

  const { error: memberError } = await getSupabaseClient()
    .from("club_members")
    .insert({
      club_id: club.id,
      user_id: user.id,
      role: "owner",
      nickname: input.nickname.trim(),
    });

  if (memberError) throw memberError;

  return inviteCode;
}

export async function joinClub(input: {
  inviteCode: string;
  nickname: string;
}) {
  await requireUser();

  const { error } = await getSupabaseClient().rpc("join_club_by_invite", {
    p_invite_code: input.inviteCode.trim().toUpperCase(),
    p_nickname: input.nickname.trim(),
  });

  if (error) throw error;
}

export async function getClubDetail(clubId: string): Promise<ClubDetail> {
  const user = await requireUser();

  const { data: club, error: clubError } = await getSupabaseClient()
    .from("clubs")
    .select("id,name,invite_code,created_at")
    .eq("id", clubId)
    .single();

  if (clubError || !club) {
    throw clubError ?? new Error("클럽을 찾을 수 없습니다.");
  }

  const { data: membership, error: memberError } = await getSupabaseClient()
    .from("club_members")
    .select("role,nickname")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership) {
    throw memberError ?? new Error("해당 클럽의 멤버가 아닙니다.");
  }

  return {
    id: club.id,
    name: club.name,
    inviteCode: club.invite_code,
    createdAt: club.created_at,
    myRole: membership.role as ClubRole,
    myNickname: membership.nickname,
  };
}

export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_members")
    .select("id,user_id,nickname,role,created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    role: row.role as ClubRole,
    createdAt: row.created_at,
  }));
}
