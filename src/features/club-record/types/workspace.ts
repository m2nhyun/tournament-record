import type { ClubRecordEvent } from "@/features/club-record/types/event";
import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordAssignmentBoard } from "@/features/club-record/types/slot";

export type ClubRecordEventWorkspaceSummary = {
  participantCount: number;
  openSlotCount: number;
  unslottedParticipantCount: number;
  timeGroupCount: number;
  hasConfirmedAutoMatch: boolean;
  assignmentDirty: boolean;
  lastAssignmentRunAt: string | null;
};

export type ClubRecordEventWorkspace = {
  event: ClubRecordEvent;
  participants: ClubRecordEventParticipant[];
  board: ClubRecordAssignmentBoard;
  summary: ClubRecordEventWorkspaceSummary;
};
