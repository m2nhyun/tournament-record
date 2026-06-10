import { describe, expect, it } from "vitest";

import {
  buildFullClubParticipants,
  buildFullClubSlots,
  FULL_CLUB_TOTALS,
} from "./full-club-fixture";
import {
  computeWomenMatchTarget,
  planClubRecordAutoAssignments,
} from "./auto-assignment";

describe("full-club fixture — 24명 분포 단위 검증", () => {
  const participants = buildFullClubParticipants();

  it("회원 20, 게스트 4, 여 6 (게스트 여 2)", () => {
    expect(participants).toHaveLength(
      FULL_CLUB_TOTALS.members + FULL_CLUB_TOTALS.guests,
    );
    expect(participants.filter((p) => p.participantType === "member")).toHaveLength(
      FULL_CLUB_TOTALS.members,
    );
    expect(participants.filter((p) => p.participantType === "guest")).toHaveLength(
      FULL_CLUB_TOTALS.guests,
    );
    expect(participants.filter((p) => p.gender === "female")).toHaveLength(
      FULL_CLUB_TOTALS.females,
    );
    expect(
      participants.filter((p) => p.participantType === "guest" && p.gender === "female"),
    ).toHaveLength(FULL_CLUB_TOTALS.femaleGuests);
  });

  it("computeWomenMatchTarget(여 6) === 2", () => {
    expect(computeWomenMatchTarget(participants)).toBe(2);
  });

  it("planClubRecordAutoAssignments는 24명을 최소 6개 quartet로 묶고 각 매치에 sides 1/2가 모두 등장", () => {
    const slots = buildFullClubSlots({ courtCount: 4, slotRoundCount: 3 });
    const plans = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 24,
      maxSharedMatchesPerDay: 2,
    });
    expect(plans.length).toBeGreaterThanOrEqual(6);
    for (const plan of plans) {
      expect(plan.players).toHaveLength(4);
      const sides = new Set(plan.players.map((p) => p.side));
      expect(sides).toEqual(new Set([1, 2]));
      const positions = plan.players.map((p) => `${p.side}-${p.position}`);
      expect(new Set(positions).size).toBe(4);
    }
  });

  it("자동 편성 결과에 all-female quartet이 목표(2)만큼 등장한다", () => {
    const slots = buildFullClubSlots({ courtCount: 4, slotRoundCount: 3 });
    const plans = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 24,
      maxSharedMatchesPerDay: 2,
    });
    const genderById = new Map<string, "male" | "female" | null | "unspecified">();
    for (const p of participants) genderById.set(p.id, p.gender);
    const allFemale = plans.filter((plan) =>
      plan.players.every((player) => genderById.get(player.participantId) === "female"),
    );
    expect(allFemale.length).toBeGreaterThanOrEqual(2);
  });

  it("코트가 부족할 때 (코트 1 / 라운드 1) 6매치 중 1매치만 계획되고 나머지는 다음 라운드에 보류", () => {
    const slots = buildFullClubSlots({ courtCount: 1, slotRoundCount: 1 });
    const plans = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 24,
    });
    expect(plans).toHaveLength(1);
  });

  it("코트/라운드가 인원에 맞을 때 (4코트×3라운드=12매치) 같은 팀 페어는 반복되지 않는다", () => {
    const slots = buildFullClubSlots({ courtCount: 4, slotRoundCount: 3 });
    const plans = planClubRecordAutoAssignments(participants, slots, {
      candidateWindowSize: 24,
      maxSharedMatchesPerDay: 2,
    });

    const pairCount = new Map<string, number>();
    for (const plan of plans) {
      const sideMap = new Map<number, string[]>();
      for (const player of plan.players) {
        const list = sideMap.get(player.side) ?? [];
        list.push(player.participantId);
        sideMap.set(player.side, list);
      }
      for (const list of sideMap.values()) {
        if (list.length !== 2) continue;
        const key = [...list].sort().join(":");
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
    const repeatedTeam = Array.from(pairCount.entries()).filter(([, count]) => count > 1);
    expect(repeatedTeam, `repeated teams: ${JSON.stringify(repeatedTeam)}`).toHaveLength(0);
  });
});
