import { describe, expect, it } from "vitest";

import { getClubRecordAccessCapabilities, getClubRecordRoleLabel } from "./access";

describe("club-record/access", () => {
  it("owner를 관리자 capability로 매핑한다", () => {
    expect(getClubRecordRoleLabel("owner")).toBe("관리자");
    expect(getClubRecordAccessCapabilities("owner")).toMatchObject({
      canManageClubData: true,
      canViewRanking: true,
      canSubmitMatchResult: true,
    });
  });

  it("member는 본인 기록 입력/조회만 가능하다", () => {
    expect(getClubRecordRoleLabel("member")).toBe("회원");
    expect(getClubRecordAccessCapabilities("member")).toMatchObject({
      canViewOwnHistory: true,
      canSubmitMatchResult: true,
      canManageClubData: false,
      canViewRanking: false,
    });
  });

  it("guest는 조회 전용 capability만 가진다", () => {
    expect(getClubRecordRoleLabel("guest")).toBe("게스트");
    expect(getClubRecordAccessCapabilities("guest")).toMatchObject({
      canViewClubRecordHome: true,
      canViewMonthlyCard: true,
      canViewOwnHistory: false,
      canSubmitMatchResult: false,
      canManageClubData: false,
    });
  });
});
