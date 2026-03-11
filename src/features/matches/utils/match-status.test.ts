import { describe, expect, it } from "vitest";

import {
  getMatchStatusCopy,
  getPendingConfirmationNames,
  getRejectedConfirmationNames,
  resolveMatchStatus,
} from "./match-status";

describe("match-status", () => {
  it("사용자 관점 상태 카피를 반환한다", () => {
    expect(getMatchStatusCopy("submitted")).toMatchObject({
      badgeLabel: "기록됨",
      historyLabel: "기록됨",
    });
    expect(getMatchStatusCopy("disputed")).toMatchObject({
      badgeLabel: "재검토 필요",
      historyLabel: "재검토",
    });
  });

  it("확인 대상 상태별 닉네임 목록을 분리한다", () => {
    const confirmations = [
      {
        id: "c1",
        clubMemberId: "cm1",
        nickname: "민호",
        side: 2 as const,
        userId: "u1",
        decision: "pending" as const,
        decidedAt: null,
      },
      {
        id: "c2",
        clubMemberId: "cm2",
        nickname: "서준",
        side: 2 as const,
        userId: "u2",
        decision: "rejected" as const,
        decidedAt: "2026-03-10T09:00:00.000Z",
      },
      {
        id: "c3",
        clubMemberId: "cm3",
        nickname: "지우",
        side: 2 as const,
        userId: "u3",
        decision: "approved" as const,
        decidedAt: "2026-03-10T09:05:00.000Z",
      },
    ];

    expect(getPendingConfirmationNames(confirmations)).toEqual(["민호"]);
    expect(getRejectedConfirmationNames(confirmations)).toEqual(["서준"]);
  });

  it("확인 결정값으로 상세 상태를 보정한다", () => {
    expect(
      resolveMatchStatus("submitted", [{ decision: "approved" }, { decision: "approved" }]),
    ).toBe("confirmed");
    expect(
      resolveMatchStatus("submitted", [{ decision: "approved" }, { decision: "rejected" }]),
    ).toBe("disputed");
    expect(
      resolveMatchStatus("confirmed", [{ decision: "approved" }, { decision: "pending" }]),
    ).toBe("submitted");
  });
});
