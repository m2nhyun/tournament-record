import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type {
  ClubRecordEventSlotOverview,
  ClubRecordSlotPlayer,
} from "@/features/club-record/types/slot";

export type ClubRecordAssignmentSnapshot = {
  matchCountByParticipantId: Map<string, number>;
  pairKeys: Set<string>;
  sharedMatchCountByPairKey: Map<string, number>;
  occupiedSlotStartsByParticipantId: Map<string, Set<string>>;
};

function normalizeTime(value: string | null) {
  return value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
}

function buildPairKey(leftParticipantId: string, rightParticipantId: string) {
  return [leftParticipantId, rightParticipantId].sort().join(":");
}

function groupPlayersBySide(players: ClubRecordSlotPlayer[]) {
  return new Map<number, ClubRecordSlotPlayer[]>(
    [1, 2].map((side) => [
      side,
      players.filter((player) => player.side === side),
    ]),
  );
}

export function buildClubRecordAssignmentSnapshot(
  slots: ClubRecordEventSlotOverview[],
): ClubRecordAssignmentSnapshot {
  const matchCountByParticipantId = new Map<string, number>();
  const pairKeys = new Set<string>();
  const sharedMatchCountByPairKey = new Map<string, number>();
  const occupiedSlotStartsByParticipantId = new Map<string, Set<string>>();

  for (const slot of slots) {
    if (!slot.match) continue;

    for (const player of slot.match.players) {
      matchCountByParticipantId.set(
        player.participantId,
        (matchCountByParticipantId.get(player.participantId) ?? 0) + 1,
      );
      const occupiedStarts =
        occupiedSlotStartsByParticipantId.get(player.participantId) ?? new Set<string>();
      occupiedStarts.add(slot.startsAt);
      occupiedSlotStartsByParticipantId.set(player.participantId, occupiedStarts);
    }

    const playersBySide = groupPlayersBySide(slot.match.players);
    for (const sidePlayers of playersBySide.values()) {
      if (sidePlayers.length !== 2) continue;
      pairKeys.add(
        buildPairKey(sidePlayers[0].participantId, sidePlayers[1].participantId),
      );
    }

    for (let leftIndex = 0; leftIndex < slot.match.players.length - 1; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < slot.match.players.length;
        rightIndex += 1
      ) {
        const pairKey = buildPairKey(
          slot.match.players[leftIndex]!.participantId,
          slot.match.players[rightIndex]!.participantId,
        );
        sharedMatchCountByPairKey.set(
          pairKey,
          (sharedMatchCountByPairKey.get(pairKey) ?? 0) + 1,
        );
      }
    }
  }

  return {
    matchCountByParticipantId,
    pairKeys,
    sharedMatchCountByPairKey,
    occupiedSlotStartsByParticipantId,
  };
}

export function canParticipantsPairAgain(
  snapshot: ClubRecordAssignmentSnapshot,
  leftParticipantId: string,
  rightParticipantId: string,
) {
  return !snapshot.pairKeys.has(buildPairKey(leftParticipantId, rightParticipantId));
}

export function canParticipantsShareMatchAgain(
  snapshot: ClubRecordAssignmentSnapshot,
  leftParticipantId: string,
  rightParticipantId: string,
  maxSharedMatches = 2,
) {
  return (
    (snapshot.sharedMatchCountByPairKey.get(
      buildPairKey(leftParticipantId, rightParticipantId),
    ) ?? 0) < maxSharedMatches
  );
}

export function isParticipantOccupiedAtSlotStart(
  snapshot: ClubRecordAssignmentSnapshot,
  participantId: string,
  slotStartsAt: string,
) {
  return (
    snapshot.occupiedSlotStartsByParticipantId
      .get(participantId)
      ?.has(slotStartsAt) ?? false
  );
}

export function getEligibleParticipantsForSlot(
  participants: ClubRecordEventParticipant[],
  slot: ClubRecordEventSlotOverview,
  snapshot: ClubRecordAssignmentSnapshot,
) {
  const slotStartsAt = new Date(slot.startsAt).getTime();

  return participants.filter((participant) => {
    const arrivalTime = normalizeTime(participant.arrivalTime);
    if (arrivalTime > slotStartsAt) return false;
    if (
      isParticipantOccupiedAtSlotStart(
        snapshot,
        participant.id,
        slot.startsAt,
      )
    ) {
      return false;
    }
    return true;
  });
}
