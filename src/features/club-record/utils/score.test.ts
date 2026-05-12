import { describe, expect, it } from "vitest";

import { parseClubRecordScoreText } from "./score";

describe("club-record/score", () => {
  it("승패 스코어를 정규화한다", () => {
    expect(parseClubRecordScoreText(" 6 - 4 ")).toEqual({
      isDraw: false,
      winningSide: 1,
      losingSide: 2,
      normalizedScoreText: "6-4",
    });

    expect(parseClubRecordScoreText("4-6")).toEqual({
      isDraw: false,
      winningSide: 2,
      losingSide: 1,
      normalizedScoreText: "4-6",
    });
  });

  it("동점 스코어를 무승부로 처리한다", () => {
    expect(parseClubRecordScoreText("5-5")).toEqual({
      isDraw: true,
      winningSide: null,
      losingSide: null,
      normalizedScoreText: "5-5",
    });
  });

  it("잘못된 형식을 거부한다", () => {
    expect(() => parseClubRecordScoreText("abc")).toThrow(
      "스코어는 `6-4` 형식으로 입력해주세요.",
    );
    expect(() => parseClubRecordScoreText("-1-4")).toThrow(
      "스코어는 `6-4` 형식으로 입력해주세요.",
    );
  });
});
