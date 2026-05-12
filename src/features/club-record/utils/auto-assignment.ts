import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordMatchPlayer } from "@/features/club-record/types/match";
import type { ClubRecordEventSlotOverview } from "@/features/club-record/types/slot";
import {
  buildClubRecordAssignmentSnapshot,
  getEligibleParticipantsForSlot,
  type ClubRecordAssignmentSnapshot,
} from "./assignment-pool";

type PlannedMatch = {
  slotId: string;
  players: ClubRecordMatchPlayer[];
};

type AutoAssignmentOptions = {
  candidateWindowSize?: number;
  maxSharedMatchesPerDay?: number;
};

type CandidatePairing = {
  players: ClubRecordMatchPlayer[];
  score: number;
};

function getGroupWeight(groupCode: ClubRecordEventParticipant["groupCode"]) {
  if (groupCode === "A") return 0;
  if (groupCode === "B") return 1;
  if (groupCode === "C") return 2;
  return 3;
}

function getRankingWeight(participant: ClubRecordEventParticipant) {
  if (typeof participant.rankingPosition === "number") {
    return participant.rankingPosition;
  }
  return 10_000 + getGroupWeight(participant.groupCode) * 100;
}

function buildParticipantPairKey(leftParticipantId: string, rightParticipantId: string) {
  return [leftParticipantId, rightParticipantId].sort().join(":");
}

function sortParticipantsForAssignment(
  participants: ClubRecordEventParticipant[],
  snapshot: ClubRecordAssignmentSnapshot,
) {
  return [...participants].sort((left, right) => {
    const leftCount = snapshot.matchCountByParticipantId.get(left.id) ?? 0;
    const rightCount = snapshot.matchCountByParticipantId.get(right.id) ?? 0;
    if (leftCount !== rightCount) return leftCount - rightCount;

    const leftGroup = getGroupWeight(left.groupCode);
    const rightGroup = getGroupWeight(right.groupCode);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;

    return getRankingWeight(left) - getRankingWeight(right);
  });
}

function getQuartetScore(
  quartet: ClubRecordEventParticipant[],
  snapshot: ClubRecordAssignmentSnapshot,
) {
  const matchCountScore = quartet.reduce(
    (sum, participant) =>
      sum + (snapshot.matchCountByParticipantId.get(participant.id) ?? 0),
    0,
  );
  const rankingWeights = quartet
    .map(getRankingWeight)
    .sort((left, right) => left - right);
  const spreadScore =
    rankingWeights[rankingWeights.length - 1] - rankingWeights[0];
  const groupSpread =
    Math.max(...quartet.map((participant) => getGroupWeight(participant.groupCode))) -
    Math.min(...quartet.map((participant) => getGroupWeight(participant.groupCode)));

  return matchCountScore * 10_000 + groupSpread * 1_000 + spreadScore;
}

function getPairingScore(
  pairA: [ClubRecordEventParticipant, ClubRecordEventParticipant],
  pairB: [ClubRecordEventParticipant, ClubRecordEventParticipant],
  snapshot: ClubRecordAssignmentSnapshot,
  maxSharedMatchesPerDay: number,
) {
  const pairAAverage =
    (getRankingWeight(pairA[0]) + getRankingWeight(pairA[1])) / 2;
  const pairBAverage =
    (getRankingWeight(pairB[0]) + getRankingWeight(pairB[1])) / 2;
  const pairASpread =
    Math.abs(getRankingWeight(pairA[0]) - getRankingWeight(pairA[1]));
  const pairBSpread =
    Math.abs(getRankingWeight(pairB[0]) - getRankingWeight(pairB[1]));

  const pairAKey = buildParticipantPairKey(pairA[0].id, pairA[1].id);
  const pairBKey = buildParticipantPairKey(pairB[0].id, pairB[1].id);
  const repeatedTeamPenalty =
    (snapshot.pairKeys.has(pairAKey) ? 100_000 : 0) +
    (snapshot.pairKeys.has(pairBKey) ? 100_000 : 0);

  const sharedParticipantIds = [pairA[0].id, pairA[1].id, pairB[0].id, pairB[1].id];
  let sharedMatchPenalty = 0;
  for (let leftIndex = 0; leftIndex < sharedParticipantIds.length - 1; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sharedParticipantIds.length;
      rightIndex += 1
    ) {
      const pairKey = buildParticipantPairKey(
        sharedParticipantIds[leftIndex]!,
        sharedParticipantIds[rightIndex]!,
      );
      const sharedCount = snapshot.sharedMatchCountByPairKey.get(pairKey) ?? 0;
      if (sharedCount >= maxSharedMatchesPerDay) {
        sharedMatchPenalty += (sharedCount - maxSharedMatchesPerDay + 1) * 50_000;
      }
    }
  }

  return (
    repeatedTeamPenalty +
    sharedMatchPenalty +
    Math.abs(pairAAverage - pairBAverage) * 10 +
    pairASpread +
    pairBSpread
  );
}

function toMatchPlayers(
  pairA: [ClubRecordEventParticipant, ClubRecordEventParticipant],
  pairB: [ClubRecordEventParticipant, ClubRecordEventParticipant],
): ClubRecordMatchPlayer[] {
  return [
    { participantId: pairA[0].id, side: 1, position: 1 },
    { participantId: pairA[1].id, side: 1, position: 2 },
    { participantId: pairB[0].id, side: 2, position: 1 },
    { participantId: pairB[1].id, side: 2, position: 2 },
  ];
}

function pickBestPairing(
  quartet: ClubRecordEventParticipant[],
  snapshot: ClubRecordAssignmentSnapshot,
  maxSharedMatchesPerDay: number,
): CandidatePairing | null {
  const [p1, p2, p3, p4] = quartet;
  const pairings: Array<
    [
      [ClubRecordEventParticipant, ClubRecordEventParticipant],
      [ClubRecordEventParticipant, ClubRecordEventParticipant],
    ]
  > = [
    [
      [p1, p2],
      [p3, p4],
    ],
    [
      [p1, p3],
      [p2, p4],
    ],
    [
      [p1, p4],
      [p2, p3],
    ],
  ];

  let best: CandidatePairing | null = null;

  for (const [pairA, pairB] of pairings) {
    const score = getPairingScore(
      pairA,
      pairB,
      snapshot,
      maxSharedMatchesPerDay,
    );
    const candidate: CandidatePairing = {
      players: toMatchPlayers(pairA, pairB),
      score,
    };

    if (!best || candidate.score < best.score) {
      best = candidate;
    }
  }

  return best;
}

function chooseBestQuartet(
  participants: ClubRecordEventParticipant[],
  snapshot: ClubRecordAssignmentSnapshot,
  candidateWindowSize: number,
  maxSharedMatchesPerDay: number,
) {
  const sorted = sortParticipantsForAssignment(participants, snapshot).slice(
    0,
    Math.max(4, candidateWindowSize),
  );

  let best:
    | {
        quartet: ClubRecordEventParticipant[];
        pairing: CandidatePairing;
        score: number;
      }
    | null = null;

  for (let a = 0; a < sorted.length - 3; a += 1) {
    for (let b = a + 1; b < sorted.length - 2; b += 1) {
      for (let c = b + 1; c < sorted.length - 1; c += 1) {
        for (let d = c + 1; d < sorted.length; d += 1) {
          const quartet = [sorted[a], sorted[b], sorted[c], sorted[d]];
          const pairing = pickBestPairing(
            quartet,
            snapshot,
            maxSharedMatchesPerDay,
          );
          if (!pairing) continue;

          const score = getQuartetScore(quartet, snapshot) * 100 + pairing.score;
          if (!best || score < best.score) {
            best = { quartet, pairing, score };
          }
        }
      }
    }
  }

  return best;
}

export function planClubRecordAutoAssignments(
  participants: ClubRecordEventParticipant[],
  slots: ClubRecordEventSlotOverview[],
  options: AutoAssignmentOptions = {},
): PlannedMatch[] {
  const candidateWindowSize = options.candidateWindowSize ?? 12;
  const maxSharedMatchesPerDay = options.maxSharedMatchesPerDay ?? 2;
  const plans: PlannedMatch[] = [];

  const assignableSlots = [...slots]
    .filter((slot) => !slot.isLocked && !slot.match)
    .sort((left, right) => {
      const timeDiff =
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return left.courtNumber - right.courtNumber;
    });

  const snapshot = buildClubRecordAssignmentSnapshot(slots);

  for (const slot of assignableSlots) {
    const eligibleParticipants = getEligibleParticipantsForSlot(
      participants,
      slot,
      snapshot,
    );

    if (eligibleParticipants.length < 4) continue;

    const bestQuartet = chooseBestQuartet(
      eligibleParticipants,
      snapshot,
      candidateWindowSize,
      maxSharedMatchesPerDay,
    );

    if (!bestQuartet) continue;

    plans.push({
      slotId: slot.id,
      players: bestQuartet.pairing.players,
    });

    for (const player of bestQuartet.pairing.players) {
      snapshot.matchCountByParticipantId.set(
        player.participantId,
        (snapshot.matchCountByParticipantId.get(player.participantId) ?? 0) + 1,
      );
      const occupiedStarts =
        snapshot.occupiedSlotStartsByParticipantId.get(player.participantId) ??
        new Set<string>();
      occupiedStarts.add(slot.startsAt);
      snapshot.occupiedSlotStartsByParticipantId.set(
        player.participantId,
        occupiedStarts,
      );
    }

    snapshot.pairKeys.add(
      [
        bestQuartet.pairing.players[0].participantId,
        bestQuartet.pairing.players[1].participantId,
      ]
        .sort()
        .join(":"),
    );
    snapshot.pairKeys.add(
      [
        bestQuartet.pairing.players[2].participantId,
        bestQuartet.pairing.players[3].participantId,
      ]
        .sort()
        .join(":"),
    );

    const plannedParticipantIds = bestQuartet.pairing.players.map(
      (player) => player.participantId,
    );
    for (let leftIndex = 0; leftIndex < plannedParticipantIds.length - 1; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < plannedParticipantIds.length;
        rightIndex += 1
      ) {
        const pairKey = buildParticipantPairKey(
          plannedParticipantIds[leftIndex]!,
          plannedParticipantIds[rightIndex]!,
        );
        snapshot.sharedMatchCountByPairKey.set(
          pairKey,
          (snapshot.sharedMatchCountByPairKey.get(pairKey) ?? 0) + 1,
        );
      }
    }
  }

  return plans;
}
