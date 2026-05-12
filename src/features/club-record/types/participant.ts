import type { ClubRecordGroupCode } from "@/features/club-record/types/member";

export type ClubRecordParticipantType = "member" | "guest";
export type ClubRecordAttendanceStatus = "registered" | "checked_in";

export type ClubRecordEventParticipant = {
  id: string;
  eventId: string;
  participantType: ClubRecordParticipantType;
  clubMemberId: string | null;
  guestProfileId: string | null;
  displayName: string;
  arrivalTime: string | null;
  attendanceStatus: ClubRecordAttendanceStatus;
  groupCode: ClubRecordGroupCode | null;
  rankingPosition: number | null;
};

export type ClubRecordAddMemberParticipantInput = {
  clubMemberId: string;
  arrivalTime?: string | null;
};

export type ClubRecordAddGuestParticipantInput = {
  guestProfileId: string;
  arrivalTime?: string | null;
};
