import type { ClubRole } from "@/features/clubs/types/club";
import type {
  ClubRecordAccessCapabilities,
  ClubRecordRoleLabel,
} from "@/features/club-record/types/access";

export function getClubRecordRoleLabel(role: ClubRole): ClubRecordRoleLabel {
  if (role === "owner") return "관리자";
  if (role === "manager") return "운영진";
  if (role === "member") return "회원";
  return "게스트";
}

export function getClubRecordAccessCapabilities(
  role: ClubRole,
): ClubRecordAccessCapabilities {
  const isAdmin = role === "owner" || role === "manager";
  const isMemberOrAbove = role === "owner" || role === "manager" || role === "member";
  const isGuest = role === "guest";

  return {
    canViewClubRecordHome: true,
    canViewOwnHistory: isMemberOrAbove,
    canViewMonthlyCard: true,
    canManageClubData: isAdmin,
    canViewRanking: isAdmin,
    canEditRanking: isAdmin,
    canCreateEvent: isAdmin,
    canManageParticipants: isAdmin,
    canRunAutoAssignment: isAdmin,
    canManageManualMatches: isAdmin,
    canSubmitMatchResult: role === "member" || role === "owner" || role === "manager",
    canEditAnyMatchResult: isAdmin,
    canManageGuestInvites: isAdmin && !isGuest,
  };
}
