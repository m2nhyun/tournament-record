import type { ClubRecordGroupCode } from "@/features/club-record/types/member";

export type ClubRecordGuestProfile = {
  id: string;
  clubId: string;
  guestUserId: string | null;
  displayName: string | null;
  gender: string | null;
  careerText: string | null;
  groupCode: ClubRecordGroupCode | null;
  operatorNote: string | null;
  linkedClubMemberId: string | null;
};

export type ClubRecordGuestInvite = {
  id: string;
  clubId: string;
  eventId: string;
  code: string;
  expiresAt: string | null;
  isActive: boolean;
};

export type ClubRecordGuestInviteVerification = {
  eventId: string;
  clubId: string;
  eventDate: string;
  startsAt: string;
  endsAt: string;
};

export type ClubRecordGuestJoinInput = ClubRecordGuestProfileInput & {
  arrivalTime?: string | null;
};

export type ClubRecordGuestJoinResult = {
  verification: ClubRecordGuestInviteVerification;
  guestProfile: ClubRecordGuestProfile;
  participantId: string;
};

export type ClubRecordGuestProfileInput = {
  displayName?: string;
  gender?: string;
  careerText?: string;
  groupCode?: ClubRecordGroupCode | null;
  operatorNote?: string;
};
