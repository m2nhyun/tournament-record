import { describe, expect, it } from "vitest";

import { getMonthStartIsoDate } from "./date";

describe("club-record/date", () => {
  it("주어진 날짜의 월 시작일을 yyyy-mm-01 형식으로 반환한다", () => {
    expect(getMonthStartIsoDate(new Date("2026-05-07T12:34:56.000Z"))).toBe(
      "2026-05-01",
    );
  });
});
