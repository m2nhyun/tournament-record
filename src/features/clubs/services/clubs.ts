import { getSupabaseClient } from "@/lib/supabase/client";
import { requireRegisteredUser, requireUser } from "@/features/auth/services/auth";

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
  invite_expires_at: string;
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
    .select("role,nickname,clubs(id,name,invite_code,invite_expires_at,created_at)")
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
        inviteExpiresAt: club.invite_expires_at,
        role: row.role,
        nickname: row.nickname,
        createdAt: club.created_at,
      } satisfies ClubSummary;
    })
    .filter((club): club is ClubSummary => club !== null);
}

export async function createClub(input: { name: string; nickname: string }) {
  const user = await requireRegisteredUser();
  const inviteCode = generateInviteCode();

  const { data: club, error: clubError } = await getSupabaseClient()
    .from("clubs")
    .insert({
      name: input.name.trim(),
      invite_code: inviteCode,
      invite_expires_at: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 30,
      ).toISOString(),
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
  await requireRegisteredUser();

  const { data, error } = await getSupabaseClient().rpc("join_club_by_invite", {
    p_invite_code: input.inviteCode.trim().toUpperCase(),
    p_nickname: input.nickname.trim(),
  });

  if (error) throw error;
  return data as string;
}

export async function joinClubAsGuest(input: {
  inviteCode: string;
  nickname: string;
}) {
  await requireUser();

  const { data, error } = await getSupabaseClient().rpc(
    "join_club_by_invite_as_guest",
    {
      p_invite_code: input.inviteCode.trim().toUpperCase(),
      p_nickname: input.nickname.trim(),
    },
  );

  if (error) throw error;
  return data as string;
}

export async function getClubDetail(clubId: string): Promise<ClubDetail> {
  const user = await requireUser();

  const { data: club, error: clubError } = await getSupabaseClient()
    .from("clubs")
    .select("id,name,invite_code,invite_expires_at,created_at")
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
    inviteExpiresAt: club.invite_expires_at,
    createdAt: club.created_at,
    myRole: membership.role as ClubRole,
    myNickname: membership.nickname,
  };
}

export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  const user = await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_members")
    .select(
      "id,user_id,nickname,role,created_at,open_kakao_profile,allow_record_search,share_history",
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    role: row.role as ClubRole,
    createdAt: row.created_at,
    isMe: row.user_id === user.id,
    openKakaoProfile: row.open_kakao_profile ?? false,
    allowRecordSearch: row.allow_record_search ?? false,
    shareHistory: row.share_history ?? false,
  }));
}

function mapClubSettingsError(error: unknown): Error {
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message: string }).message ?? "")
      : "";

  if (
    message.includes("idx_clubs_name_normalized_unique") ||
    message.includes("clubs_name_normalized_unique")
  ) {
    return new Error("이미 사용 중인 클럽 이름입니다.");
  }

  if (
    message.includes("idx_club_members_nickname_normalized_unique") ||
    message.includes("club_members_nickname_normalized_unique")
  ) {
    return new Error("클럽 내 중복된 닉네임입니다.");
  }

  if (message.includes("Only owner can update club name")) {
    return new Error("클럽장만 클럽 이름을 변경할 수 있습니다.");
  }
  if (message.includes("Only owner can regenerate invite code")) {
    return new Error("클럽장만 초대 코드를 재발급할 수 있습니다.");
  }

  if (message.includes("Not a club member")) {
    return new Error("클럽 멤버만 닉네임을 변경할 수 있습니다.");
  }

  if (message.includes("violates check constraint")) {
    return new Error("이름/닉네임은 2~24자로 입력해주세요.");
  }

  if (error instanceof Error) return error;
  return new Error("설정 변경 중 오류가 발생했습니다.");
}

export async function updateClubName(clubId: string, name: string) {
  await requireUser();

  const { error } = await getSupabaseClient().rpc("update_club_name", {
    p_club_id: clubId,
    p_name: name.trim(),
  });
  if (error) throw mapClubSettingsError(error);
}

export async function updateMyClubNickname(clubId: string, nickname: string) {
  await requireUser();

  const { error } = await getSupabaseClient().rpc("update_my_club_nickname", {
    p_club_id: clubId,
    p_nickname: nickname.trim(),
  });
  if (error) throw mapClubSettingsError(error);
}

export async function updateMyClubMemberSettings(
  clubId: string,
  input: {
    nickname: string;
    openKakaoProfile: boolean;
    allowRecordSearch: boolean;
    shareHistory: boolean;
  },
) {
  await requireUser();

  const { error } = await getSupabaseClient().rpc(
    "update_my_club_member_settings",
    {
      p_club_id: clubId,
      p_nickname: input.nickname.trim(),
      p_open_kakao_profile: input.openKakaoProfile,
      p_allow_record_search: input.allowRecordSearch,
      p_share_history: input.shareHistory,
    },
  );
  if (error) throw mapClubSettingsError(error);
}

export async function regenerateClubInviteCode(clubId: string, daysValid = 30) {
  await requireUser();

  const { data, error } = await getSupabaseClient().rpc(
    "regenerate_club_invite_code",
    {
      p_club_id: clubId,
      p_days_valid: daysValid,
    },
  );
  if (error) throw mapClubSettingsError(error);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    inviteCode: String(row?.invite_code ?? ""),
    inviteExpiresAt: String(row?.invite_expires_at ?? ""),
  };
}
