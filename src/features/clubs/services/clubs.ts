import { supabaseClient } from "@/lib/supabase/client";

import type { ClubSummary, ClubRole } from "@/features/clubs/types/club";

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
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function ensureAnonymousUser() {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) throw error;
  if (user) return user;

  const { data, error: signInError } = await supabaseClient.auth.signInAnonymously();
  if (signInError || !data.user) {
    throw new Error("익명 로그인 실패: Supabase Auth에서 Anonymous Sign-ins를 활성화하세요.");
  }

  return data.user;
}

export async function listMyClubs(): Promise<ClubSummary[]> {
  const user = await ensureAnonymousUser();

  const { data, error } = await supabaseClient
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
  const user = await ensureAnonymousUser();
  const inviteCode = generateInviteCode();

  const { data: club, error: clubError } = await supabaseClient
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

  const { error: memberError } = await supabaseClient.from("club_members").insert({
    club_id: club.id,
    user_id: user.id,
    role: "owner",
    nickname: input.nickname.trim(),
  });

  if (memberError) throw memberError;

  return inviteCode;
}

export async function joinClub(input: { inviteCode: string; nickname: string }) {
  await ensureAnonymousUser();

  const { error } = await supabaseClient.rpc("join_club_by_invite", {
    p_invite_code: input.inviteCode.trim().toUpperCase(),
    p_nickname: input.nickname.trim(),
  });

  if (error) throw error;
}
