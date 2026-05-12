import type {
  ClubRecordAssignmentMode,
  ClubRecordMatchStatus,
} from "@/features/club-record/types/match";

export type ClubRecordSlotStatus =
  | "scheduled"
  | "ready"
  | "completed"
  | "cancelled";

export type ClubRecordEventSlot = {
  id: string;
  eventId: string;
  courtNumber: number;
  slotOrder: number;
  startsAt: string;
  endsAt: string;
  status: ClubRecordSlotStatus;
  isLocked: boolean;
};

export type ClubRecordSlotPlayer = {
  participantId: string;
  displayName: string;
  side: 1 | 2;
  position: 1 | 2;
};

export type ClubRecordSlotMatchSummary = {
  id: string;
  status: ClubRecordMatchStatus;
  assignmentMode: ClubRecordAssignmentMode;
  isManual: boolean;
  confirmedAt: string | null;
  scoreText: string | null;
  players: ClubRecordSlotPlayer[];
};

export type ClubRecordEventSlotOverview = ClubRecordEventSlot & {
  match: ClubRecordSlotMatchSummary | null;
};

export type ClubRecordAssignmentBoardSlot = ClubRecordEventSlotOverview & {
  availableParticipantIds: string[];
};

export type ClubRecordAssignmentBoard = {
  slots: ClubRecordAssignmentBoardSlot[];
  unslottedParticipantIds: string[];
  openSlotIds: string[];
  timeGroups: ClubRecordAssignmentTimeGroup[];
};

export type ClubRecordAssignmentTimeGroup = {
  startsAt: string;
  endsAt: string;
  slotIds: string[];
  openSlotIds: string[];
  occupiedParticipantIds: string[];
  availableParticipantIds: string[];
};
