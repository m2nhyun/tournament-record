import type { ClubRole } from "@/features/clubs/types/club";

export type ClubRecordRoleLabel = "관리자" | "운영진" | "회원" | "게스트";

export type ClubRecordAccessCapabilities = {
  canViewClubRecordHome: boolean;
  canViewOwnHistory: boolean;
  canViewMonthlyCard: boolean;
  canManageClubData: boolean;
  canViewRanking: boolean;
  canEditRanking: boolean;
  canCreateEvent: boolean;
  canManageParticipants: boolean;
  canRunAutoAssignment: boolean;
  canManageManualMatches: boolean;
  canSubmitMatchResult: boolean;
  canEditAnyMatchResult: boolean;
  canManageGuestInvites: boolean;
};

export type ClubRecordAccessContext = {
  clubId: string;
  clubMemberId: string | null;
  role: ClubRole;
  roleLabel: ClubRecordRoleLabel;
  capabilities: ClubRecordAccessCapabilities;
};
