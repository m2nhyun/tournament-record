import { describe, expect, it } from "vitest";

import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordEventSlotOverview } from "@/features/club-record/types/slot";
import { buildClubRecordAssignmentBoard } from "./assignment-board";

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
    groupCode: "B",
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
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "C",
    rankingPosition: 5,
  },
];

const slots: ClubRecordEventSlotOverview[] = [
  {
    id: "slot-1",
    eventId: "event-1",
    courtNumber: 1,
    slotOrder: 1,
    startsAt: "2026-05-07T10:00:00.000Z",
    endsAt: "2026-05-07T10:30:00.000Z",
    status: "ready",
    isLocked: true,
    match: {
      id: "match-1",
      status: "pending_result",
      assignmentMode: "manual",
      isManual: true,
      confirmedAt: null,
      scoreText: null,
      players: [
        { participantId: "p1", displayName: "1", side: 1, position: 1 },
        { participantId: "p2", displayName: "2", side: 1, position: 2 },
        { participantId: "p3", displayName: "3", side: 2, position: 1 },
        { participantId: "p4", displayName: "4", side: 2, position: 2 },
      ],
    },
  },
  {
    id: "slot-2",
    eventId: "event-1",
    courtNumber: 2,
    slotOrder: 1,
    startsAt: "2026-05-07T10:00:00.000Z",
    endsAt: "2026-05-07T10:30:00.000Z",
    status: "scheduled",
    isLocked: false,
    match: null,
  },
  {
    id: "slot-3",
    eventId: "event-1",
    courtNumber: 1,
    slotOrder: 2,
    startsAt: "2026-05-07T10:30:00.000Z",
    endsAt: "2026-05-07T11:00:00.000Z",
    status: "scheduled",
    isLocked: false,
    match: null,
  },
];

describe("club-record/assignment-board", () => {
  it("같은 시간대에 이미 배정된 인원은 다른 코트의 available 목록에서 제외한다", () => {
    const board = buildClubRecordAssignmentBoard(participants, slots);

    const sameTimeOpenSlot = board.slots.find((slot) => slot.id === "slot-2");
    const laterSlot = board.slots.find((slot) => slot.id === "slot-3");
    const firstTimeGroup = board.timeGroups[0];
    const secondTimeGroup = board.timeGroups[1];

    expect(sameTimeOpenSlot?.availableParticipantIds).toEqual(["p5"]);
    expect(laterSlot?.availableParticipantIds).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(board.unslottedParticipantIds).toEqual(["p5"]);
    expect(firstTimeGroup).toMatchObject({
      slotIds: ["slot-1", "slot-2"],
      openSlotIds: [],
      occupiedParticipantIds: ["p1", "p2", "p3", "p4"],
      availableParticipantIds: ["p5"],
    });
    expect(secondTimeGroup).toMatchObject({
      slotIds: ["slot-3"],
      openSlotIds: ["slot-3"],
      availableParticipantIds: ["p1", "p2", "p3", "p4", "p5"],
    });
  });
});
