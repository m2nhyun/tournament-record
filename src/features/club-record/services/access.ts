import { getClubDetail } from "@/features/clubs/services/clubs";
import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ClubRecordAccessContext } from "@/features/club-record/types/access";
import {
  getClubRecordAccessCapabilities,
  getClubRecordRoleLabel,
} from "@/features/club-record/utils/access";

type ClubRecordCapabilityKey =
  keyof ClubRecordAccessContext["capabilities"];

type ClubMemberIdRow = {
  id: string;
};

export async function getClubRecordAccessContext(
  clubId: string,
): Promise<ClubRecordAccessContext> {
  const user = await requireUser();
  const club = await getClubDetail(clubId);
  const { data: membership, error: membershipError } = await getSupabaseClient()
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) throw membershipError;

  return {
    clubId,
    clubMemberId: membership ? String((membership as ClubMemberIdRow).id) : null,
    role: club.myRole,
    roleLabel: getClubRecordRoleLabel(club.myRole),
    capabilities: getClubRecordAccessCapabilities(club.myRole),
  };
}

export async function requireClubRecordCapability(
  clubId: string,
  capability: ClubRecordCapabilityKey,
  message = "club record 권한이 없습니다.",
): Promise<ClubRecordAccessContext> {
  const context = await getClubRecordAccessContext(clubId);

  if (!context.capabilities[capability]) {
    throw new Error(message);
  }

  return context;
}

export async function requireClubRecordAdminAccess(
  clubId: string,
  message = "운영진 이상만 접근할 수 있습니다.",
) {
  return requireClubRecordCapability(clubId, "canManageClubData", message);
}

export async function requireClubRecordMemberAccess(
  clubId: string,
  message = "회원 이상만 접근할 수 있습니다.",
) {
  return requireClubRecordCapability(clubId, "canViewOwnHistory", message);
}
