import { describe, expect, it } from "vitest";

import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordEventSlotOverview } from "@/features/club-record/types/slot";
import {
  buildClubRecordAssignmentSnapshot,
  canParticipantsPairAgain,
  canParticipantsShareMatchAgain,
  getEligibleParticipantsForSlot,
  isParticipantOccupiedAtSlotStart,
} from "./assignment-pool";

const participants: ClubRecordEventParticipant[] = [
  {
    id: "p1",
    eventId: "event-1",
    participantType: "member",
    clubMemberId: "m1",
    guestProfileId: null,
    displayName: "A",
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
    displayName: "B",
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
    displayName: "C",
    arrivalTime: "2026-05-06T11:00:00.000Z",
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
    displayName: "D",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "B",
    rankingPosition: 4,
  },
  {
    id: "p5",
    eventId: "event-1",
    participantType: "guest",
    clubMemberId: null,
    guestProfileId: "g1",
    displayName: "E",
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "C",
    rankingPosition: null,
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
    status: "ready",
    isLocked: true,
    match: {
      id: "match-1",
      status: "confirmed",
      assignmentMode: "manual",
      isManual: true,
      confirmedAt: "2026-05-06T10:35:00.000Z",
      scoreText: "6-4",
      players: [
        { participantId: "p1", displayName: "A", side: 1, position: 1 },
        { participantId: "p2", displayName: "B", side: 1, position: 2 },
        { participantId: "p4", displayName: "D", side: 2, position: 1 },
        { participantId: "p5", displayName: "E", side: 2, position: 2 },
      ],
    },
  },
  {
    id: "slot-2",
    eventId: "event-1",
    courtNumber: 1,
    slotOrder: 3,
    startsAt: "2026-05-06T11:00:00.000Z",
    endsAt: "2026-05-06T11:30:00.000Z",
    status: "scheduled",
    isLocked: false,
    match: null,
  },
];

describe("club-record/assignment-pool", () => {
  it("기존 경기로부터 경기 수와 페어 이력을 계산한다", () => {
    const snapshot = buildClubRecordAssignmentSnapshot(slots);

    expect(snapshot.matchCountByParticipantId.get("p1")).toBe(1);
    expect(snapshot.matchCountByParticipantId.get("p5")).toBe(1);
    expect(canParticipantsPairAgain(snapshot, "p1", "p2")).toBe(false);
    expect(canParticipantsPairAgain(snapshot, "p1", "p4")).toBe(true);
    expect(canParticipantsShareMatchAgain(snapshot, "p1", "p4", 2)).toBe(true);
    expect(
      isParticipantOccupiedAtSlotStart(
        snapshot,
        "p1",
        "2026-05-06T10:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("늦참 시간만 기준으로 후보를 거른다", () => {
    const snapshot = buildClubRecordAssignmentSnapshot([
      ...slots,
      {
        ...slots[0],
        id: "slot-3",
        match: {
          ...slots[0].match!,
          id: "match-2",
          players: [
            { participantId: "p1", displayName: "A", side: 1, position: 1 },
            { participantId: "p4", displayName: "D", side: 1, position: 2 },
            { participantId: "p2", displayName: "B", side: 2, position: 1 },
            { participantId: "p5", displayName: "E", side: 2, position: 2 },
          ],
        },
      },
    ]);

    const eligible = getEligibleParticipantsForSlot(
      participants,
      slots[1],
      snapshot,
    );

    expect(snapshot.matchCountByParticipantId.get("p1")).toBe(2);
    expect(eligible.map((participant) => participant.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
    ]);
  });
});
