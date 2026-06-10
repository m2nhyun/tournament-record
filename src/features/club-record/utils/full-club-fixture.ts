/**
 * 24명 시나리오용 in-memory fixture builder.
 *
 * scripts/qa/full-club/fixture.mjs와 같은 분포 (회원 20 / 게스트 4, 여 6 그중 게스트 2)를
 * 따르되, DB에 의존하지 않고 알고리즘 입력 형식(ClubRecordEventParticipant)으로 만들어
 * vitest 단위 시나리오에서 그대로 사용한다.
 */
import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordEventSlotOverview } from "@/features/club-record/types/slot";

type BuildOptions = {
  eventId?: string;
  courtCount?: number;
  slotRoundCount?: number;
};

const FEMALE_MEMBER_COUNT = 4;
const MALE_MEMBER_COUNT = 16;
const FEMALE_GUEST_COUNT = 2;
const MALE_GUEST_COUNT = 2;

export function buildFullClubParticipants(): ClubRecordEventParticipant[] {
  const participants: ClubRecordEventParticipant[] = [];
  let rank = 1;

  for (let i = 0; i < FEMALE_MEMBER_COUNT; i += 1) {
    participants.push(buildMember(rank, `여회원${i + 1}`, "female"));
    rank += 1;
  }
  for (let i = 0; i < MALE_MEMBER_COUNT; i += 1) {
    participants.push(buildMember(rank, `남회원${String(i + 1).padStart(2, "0")}`, "male"));
    rank += 1;
  }
  for (let i = 0; i < FEMALE_GUEST_COUNT; i += 1) {
    participants.push(buildGuest(`여게스트${i + 1}`, "female"));
  }
  for (let i = 0; i < MALE_GUEST_COUNT; i += 1) {
    participants.push(buildGuest(`남게스트${i + 1}`, "male"));
  }
  return participants;
}

function buildMember(
  rank: number,
  displayName: string,
  gender: ClubRecordEventParticipant["gender"],
): ClubRecordEventParticipant {
  return {
    id: `member-${String(rank).padStart(2, "0")}`,
    eventId: "fixture-event",
    participantType: "member",
    clubMemberId: `cm-${String(rank).padStart(2, "0")}`,
    guestProfileId: null,
    displayName,
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: rank <= 4 ? "A" : rank <= 10 ? "B" : "C",
    rankingPosition: rank,
    gender,
  };
}

function buildGuest(
  displayName: string,
  gender: ClubRecordEventParticipant["gender"],
): ClubRecordEventParticipant {
  const index = displayName.endsWith("1")
    ? "01"
    : displayName.endsWith("2")
      ? "02"
      : "99";
  return {
    id: `guest-${gender === "female" ? "f" : "m"}-${index}`,
    eventId: "fixture-event",
    participantType: "guest",
    clubMemberId: null,
    guestProfileId: `gp-${gender === "female" ? "f" : "m"}-${index}`,
    displayName,
    arrivalTime: null,
    attendanceStatus: "registered",
    groupCode: "C",
    rankingPosition: null,
    gender,
  };
}

export function buildFullClubSlots(options: BuildOptions = {}): ClubRecordEventSlotOverview[] {
  const courtCount = options.courtCount ?? 4;
  const slotRoundCount = options.slotRoundCount ?? 3;
  const eventId = options.eventId ?? "fixture-event";

  const slots: ClubRecordEventSlotOverview[] = [];
  const baseStart = new Date("2026-06-10T09:00:00.000Z").getTime();
  const SLOT_MS = 30 * 60 * 1000;
  for (let round = 0; round < slotRoundCount; round += 1) {
    const startsAt = new Date(baseStart + round * SLOT_MS).toISOString();
    const endsAt = new Date(baseStart + (round + 1) * SLOT_MS).toISOString();
    for (let court = 1; court <= courtCount; court += 1) {
      slots.push({
        id: `slot-${round + 1}-${court}`,
        eventId,
        courtNumber: court,
        slotOrder: round + 1,
        startsAt,
        endsAt,
        status: "scheduled",
        isLocked: false,
        match: null,
      });
    }
  }
  return slots;
}

export const FULL_CLUB_TOTALS = {
  members: FEMALE_MEMBER_COUNT + MALE_MEMBER_COUNT,
  guests: FEMALE_GUEST_COUNT + MALE_GUEST_COUNT,
  females: FEMALE_MEMBER_COUNT + FEMALE_GUEST_COUNT,
  femaleGuests: FEMALE_GUEST_COUNT,
} as const;
