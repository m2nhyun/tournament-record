import { describe, expect, it } from "vitest";

import { canRecordMatch } from "./match-permissions";

describe("canRecordMatch", () => {
  it("게스트는 경기 기록 권한이 없다", () => {
    expect(
      canRecordMatch({
        id: "1",
        userId: "u1",
        nickname: "게스트",
        role: "guest",
        isActive: true,
        createdAt: "2026-03-06T00:00:00.000Z",
        isMe: true,
        openKakaoProfile: false,
        allowRecordSearch: false,
        shareHistory: false,
      }),
    ).toBe(false);
  });

  it("일반 멤버는 경기 기록 권한이 있다", () => {
    expect(
      canRecordMatch({
        id: "1",
        userId: "u1",
        nickname: "멤버",
        role: "member",
        isActive: true,
        createdAt: "2026-03-06T00:00:00.000Z",
        isMe: true,
        openKakaoProfile: false,
        allowRecordSearch: false,
        shareHistory: false,
      }),
    ).toBe(true);
  });

  it("멤버십이 없으면 경기 기록 권한이 없다", () => {
    expect(canRecordMatch(null)).toBe(false);
  });
});
