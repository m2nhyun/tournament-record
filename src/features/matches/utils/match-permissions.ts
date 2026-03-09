import type { ClubMember } from "@/features/clubs/types/club";

export function canRecordMatch(myMembership: ClubMember | null) {
  if (!myMembership) return false;
  return myMembership.role !== "guest";
}

