import { getClubRecordEvent } from "@/features/club-record/services/events";
import { getClubRecordParticipants } from "@/features/club-record/services/participants";
import { getEventAssignmentBoard } from "@/features/club-record/services/assignment";
import type { ClubRecordEventWorkspace } from "@/features/club-record/types/workspace";

export async function getClubRecordEventWorkspace(
  eventId: string,
): Promise<ClubRecordEventWorkspace> {
  const event = await getClubRecordEvent(eventId);
  const participants = await getClubRecordParticipants(eventId);
  const board = await getEventAssignmentBoard(eventId);

  const hasConfirmedAutoMatch = board.slots.some(
    (slot) =>
      slot.match?.assignmentMode === "auto" && slot.match.status === "confirmed",
  );

  return {
    event,
    participants,
    board,
    summary: {
      participantCount: participants.length,
      openSlotCount: board.openSlotIds.length,
      unslottedParticipantCount: board.unslottedParticipantIds.length,
      timeGroupCount: board.timeGroups.length,
      hasConfirmedAutoMatch,
      assignmentDirty: event.assignmentDirty,
      lastAssignmentRunAt: event.lastAssignmentRunAt,
    },
  };
}
