import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type {
  ClubRecordAssignmentBoard,
  ClubRecordAssignmentTimeGroup,
  ClubRecordEventSlotOverview,
} from "@/features/club-record/types/slot";
import {
  buildClubRecordAssignmentSnapshot,
  getEligibleParticipantsForSlot,
} from "./assignment-pool";

export function buildClubRecordAssignmentBoard(
  participants: ClubRecordEventParticipant[],
  slots: ClubRecordEventSlotOverview[],
): ClubRecordAssignmentBoard {
  const snapshot = buildClubRecordAssignmentSnapshot(slots);

  const enrichedSlots = slots.map((slot) => ({
    ...slot,
    availableParticipantIds: slot.match
      ? []
      : getEligibleParticipantsForSlot(participants, slot, snapshot).map(
          (participant) => participant.id,
        ),
  }));

  const assignedParticipantIds = new Set<string>();
  for (const slot of slots) {
    for (const player of slot.match?.players ?? []) {
      assignedParticipantIds.add(player.participantId);
    }
  }

  const timeGroupMap = new Map<string, ClubRecordAssignmentTimeGroup>();
  for (const slot of enrichedSlots) {
    const groupKey = `${slot.startsAt}::${slot.endsAt}`;
    const existingGroup = timeGroupMap.get(groupKey);

    if (!existingGroup) {
      timeGroupMap.set(groupKey, {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        slotIds: [slot.id],
        openSlotIds:
          !slot.match && slot.availableParticipantIds.length >= 4 ? [slot.id] : [],
        occupiedParticipantIds: (slot.match?.players ?? []).map(
          (player) => player.participantId,
        ),
        availableParticipantIds: [...slot.availableParticipantIds],
      });
      continue;
    }

    existingGroup.slotIds.push(slot.id);
    if (!slot.match && slot.availableParticipantIds.length >= 4) {
      existingGroup.openSlotIds.push(slot.id);
    }
    for (const player of slot.match?.players ?? []) {
      if (!existingGroup.occupiedParticipantIds.includes(player.participantId)) {
        existingGroup.occupiedParticipantIds.push(player.participantId);
      }
    }
    for (const participantId of slot.availableParticipantIds) {
      if (!existingGroup.availableParticipantIds.includes(participantId)) {
        existingGroup.availableParticipantIds.push(participantId);
      }
    }
  }

  const timeGroups = Array.from(timeGroupMap.values()).sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );

  return {
    slots: enrichedSlots,
    unslottedParticipantIds: participants
      .filter((participant) => !assignedParticipantIds.has(participant.id))
      .map((participant) => participant.id),
    openSlotIds: enrichedSlots
      .filter((slot) => !slot.match && slot.availableParticipantIds.length >= 4)
      .map((slot) => slot.id),
    timeGroups,
  };
}
