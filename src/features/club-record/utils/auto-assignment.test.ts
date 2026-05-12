import { describe, expect, it } from "vitest";

import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordEventSlotOverview } from "@/features/club-record/types/slot";
import { planClubRecordAutoAssignments } from "./auto-assignment";

const participants: ClubRecordEventParticipant[] = [
  {
    id: "p1",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m1",
    guestProfileId: null,
    displayName: "1",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "A",
    rankingPosition: 1,
  },
  {
    id: "p2",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m2",
    guestProfileId: null,
    displayName: "2",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "A",
    rankingPosition: 2,
  },
  {
    id: "p3",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m3",
    guestProfileId: null,
    displayName: "3",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "A",
    rankingPosition: 3,
  },
  {
    id: "p4",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m4",
    guestProfileId: null,
    displayName: "4",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "B",
    rankingPosition: 4,
  },
  {
    id: "p5",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m5",
    guestProfileId: null,
    displayName: "5",
    arrivalTime: "2026-05-06T11:00:00.000Z",
    attendanceStatus: "registered",
    groupCode: "B",
    rankingPosition: 5,
  },
  {
    id: "p6",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m6",
    guestProfileId: null,
    displayName: "6",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "C",
    rankingPosition: 6,
  },
];

const slots: ClubRecordEventSlotOverview[] = [
  {
    id: "slot-1",
    eventId: "event-1",
    courtNumber: 1,
    slotOrder: 1,
    startsAt: "2026-05-06T10:00:00.000Z",
    endsAt: "2026-05-06T10:30:00.000Z",
    status: "scheduled",
    isLocked: false,
    match: null,
  },
  {
    id: "slot-2",
    eventId: "event-1",
    courtNumber: 1,
    slotOrder: 2,
    startsAt: "2026-05-06T11:00:00.000Z",
    endsAt: "2026-05-06T11:30:00.000Z",
    status: "scheduled",
    isLocked: false,
    match: null,
  },
];

describe("club-record/auto-assignment", () => {
  it("같은 페어를 반복하지 않고 슬롯별 계획을 만든다", () => {
    const plans = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 6,
    });

    expect(plans).toHaveLength(2);
    expect(plans[0]?.players).toHaveLength(4);
    expect(plans[1]?.players).toHaveLength(4);

    const firstPairs = [
      [plans[0]!.players[0]!.participantId, plans[0]!.players[1]!.participantId]
        .sort()
        .join(":"),
      [plans[0]!.players[2]!.participantId, plans[0]!.players[3]!.participantId]
        .sort()
        .join(":"),
    ];
    const secondPairs = [
      [plans[1]!.players[0]!.participantId, plans[1]!.players[1]!.participantId]
        .sort()
        .join(":"),
      [plans[1]!.players[2]!.participantId, plans[1]!.players[3]!.participantId]
        .sort()
        .join(":"),
    ];

    expect(secondPairs.some((pairKey) => firstPairs.includes(pairKey))).toBe(false);
  });

  it("늦참은 도착 시간 이후 슬롯부터만 편성 후보에 포함된다", () => {
    const plans = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 6,
    });

    const firstSlotPlayerIds = plans[0]!.players.map((player) => player.participantId);
    const secondSlotPlayerIds = plans[1]!.players.map((player) => player.participantId);

    expect(firstSlotPlayerIds.includes("p5")).toBe(false);
    expect(secondSlotPlayerIds.includes("p5")).toBe(true);
  });

  it("인당 경기 수 상한 없이 빈 슬롯을 계속 채우되 같은 사람 조합 반복을 우선 피한다", () => {
    const moreSlots: ClubRecordEventSlotOverview[] = [
      ...slots,
      {
        id: "slot-3",
        eventId: "event-1",
        courtNumber: 1,
        slotOrder: 3,
        startsAt: "2026-05-06T11:30:00.000Z",
        endsAt: "2026-05-06T12:00:00.000Z",
        status: "scheduled",
        isLocked: false,
        match: null,
      },
    ];

    const plans = planClubRecordAutoAssignments(participants, moreSlots, {
      candidateWindowSize: 6,
      maxSharedMatchesPerDay: 2,
    });

    expect(plans).toHaveLength(3);

    const overlapCounter = new Map<string, number>();
    for (const plan of plans) {
      const ids = plan.players.map((player) => player.participantId);
      for (let leftIndex = 0; leftIndex < ids.length - 1; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
          const key = [ids[leftIndex]!, ids[rightIndex]!].sort().join(":");
          overlapCounter.set(key, (overlapCounter.get(key) ?? 0) + 1);
        }
      }
    }

    expect(Math.max(...overlapCounter.values())).toBeLessThanOrEqual(2);
  });

  it("참가자가 4명뿐이면 조합 반복 규칙보다 슬롯 채우기를 우선한다", () => {
    const sequentialSlots: ClubRecordEventSlotOverview[] = Array.from(
      { length: 4 },
      (_, index) => ({
        id: `limited-slot-${index + 1}`,
        eventId: "event-1",
        courtNumber: 1,
        slotOrder: index + 1,
        startsAt: `2026-05-06T1${index}:00:00.000Z`,
        endsAt: `2026-05-06T1${index}:30:00.000Z`,
        status: "scheduled" as const,
        isLocked: false,
        match: null,
      }),
    );

    const plans = planClubRecordAutoAssignments(
      participants.slice(0, 4),
      sequentialSlots,
      {
        candidateWindowSize: 4,
        maxSharedMatchesPerDay: 2,
      },
    );

    expect(plans).toHaveLength(4);
    expect(plans.every((plan) => plan.players.length === 4)).toBe(true);
    expect(plans.map((plan) => plan.slotId)).toEqual([
      "limited-slot-1",
      "limited-slot-2",
      "limited-slot-3",
      "limited-slot-4",
    ]);
  });

  it("같은 시작 시간의 여러 코트에는 같은 사람을 중복 배정하지 않는다", () => {
    const simultaneousSlots: ClubRecordEventSlotOverview[] = [
      {
        id: "slot-a",
        eventId: "event-1",
        courtNumber: 1,
        slotOrder: 1,
        startsAt: "2026-05-06T10:00:00.000Z",
        endsAt: "2026-05-06T10:30:00.000Z",
        status: "scheduled",
        isLocked: false,
        match: null,
      },
      {
        id: "slot-b",
        eventId: "event-1",
        courtNumber: 2,
        slotOrder: 1,
        startsAt: "2026-05-06T10:00:00.000Z",
        endsAt: "2026-05-06T10:30:00.000Z",
        status: "scheduled",
        isLocked: false,
        match: null,
      },
    ];

    const plans = planClubRecordAutoAssignments(participants.slice(0, 4), simultaneousSlots, {
      candidateWindowSize: 4,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.players).toHaveLength(4);
  });

  it("동시간대 2코트는 참가자 8명부터 모두 채운다", () => {
    const participantsForTwoCourts: ClubRecordEventParticipant[] = Array.from(
      { length: 8 },
      (_, index) => ({
        id: `same-time-p${index + 1}`,
        eventId: "event-1",
        participantType: "member" as const,
        clubMemberId: `same-time-m${index + 1}`,
        guestProfileId: null,
        displayName: `${index + 1}`,
        arrivalTime: null,
        attendanceStatus: "registered" as const,
        groupCode: index < 3 ? "A" : index < 6 ? "B" : "C",
        rankingPosition: index + 1,
      }),
    );
    const simultaneousSlots: ClubRecordEventSlotOverview[] = [
      {
        id: "same-time-slot-1",
        eventId: "event-1",
        courtNumber: 1,
        slotOrder: 1,
        startsAt: "2026-05-06T10:00:00.000Z",
        endsAt: "2026-05-06T10:30:00.000Z",
        status: "scheduled",
        isLocked: false,
        match: null,
      },
      {
        id: "same-time-slot-2",
        eventId: "event-1",
        courtNumber: 2,
        slotOrder: 1,
        startsAt: "2026-05-06T10:00:00.000Z",
        endsAt: "2026-05-06T10:30:00.000Z",
        status: "scheduled",
        isLocked: false,
        match: null,
      },
    ];

    for (const participantCount of [5, 6, 7]) {
      const plans = planClubRecordAutoAssignments(
        participantsForTwoCourts.slice(0, participantCount),
        simultaneousSlots,
        {
          candidateWindowSize: 8,
        },
      );

      expect(plans, `${participantCount} participants`).toHaveLength(1);
    }

    const fullCourtPlans = planClubRecordAutoAssignments(
      participantsForTwoCourts,
      simultaneousSlots,
      {
        candidateWindowSize: 8,
      },
    );

    expect(fullCourtPlans).toHaveLength(2);
    expect(
      new Set(
        fullCourtPlans.flatMap((plan) =>
          plan.players.map((player) => player.participantId),
        ),
      ).size,
    ).toBe(8);
  });

  it("동시간대에 이미 수동 경기로 점유된 참가자는 다른 오픈 슬롯 후보에서 제외한다", () => {
    const participantsForManualOverlap: ClubRecordEventParticipant[] = Array.from(
      { length: 8 },
      (_, index) => ({
        id: `manual-p${index + 1}`,
        eventId: "event-1",
        participantType: "member" as const,
        clubMemberId: `m${index + 1}`,
        guestProfileId: null,
        displayName: `${index + 1}`,
        arrivalTime: null,
        attendanceStatus: "registered" as const,
        groupCode: index < 4 ? "A" : "B",
        rankingPosition: index + 1,
      }),
    );

    const slotsWithManualMatch: ClubRecordEventSlotOverview[] = [
      {
        id: "manual-slot",
        eventId: "event-1",
        courtNumber: 1,
        slotOrder: 1,
        startsAt: "2026-05-06T10:00:00.000Z",
        endsAt: "2026-05-06T10:30:00.000Z",
        status: "ready",
        isLocked: true,
        match: {
          id: "manual-match",
          status: "pending_result",
          assignmentMode: "manual",
          isManual: true,
          confirmedAt: null,
          scoreText: null,
          players: [
            { participantId: "manual-p1", displayName: "1", side: 1, position: 1 },
            { participantId: "manual-p2", displayName: "2", side: 1, position: 2 },
            { participantId: "manual-p3", displayName: "3", side: 2, position: 1 },
            { participantId: "manual-p4", displayName: "4", side: 2, position: 2 },
          ],
        },
      },
      {
        id: "open-slot",
        eventId: "event-1",
        courtNumber: 2,
        slotOrder: 1,
        startsAt: "2026-05-06T10:00:00.000Z",
        endsAt: "2026-05-06T10:30:00.000Z",
        status: "scheduled",
        isLocked: false,
        match: null,
      },
    ];

    const plans = planClubRecordAutoAssignments(
      participantsForManualOverlap,
      slotsWithManualMatch,
      {
        candidateWindowSize: 8,
      },
    );

    expect(plans).toHaveLength(1);
    expect(plans[0]?.slotId).toBe("open-slot");
    expect(plans[0]?.players.map((player) => player.participantId).sort()).toEqual([
      "manual-p5",
      "manual-p6",
      "manual-p7",
      "manual-p8",
    ]);
  });
});
