import { describe, expect, it } from "vitest";

import { filterMatchesByDateAndOpponent } from "./match-history-filter";
import type { MatchSummary } from "../types/match";

function makeMatch(input: Partial<MatchSummary>): MatchSummary {
  return {
    id: "m",
    clubId: "c",
    matchType: "singles",
    status: "submitted",
    playedAt: "2026-03-06T10:00:00.000Z",
    scoreSummary: "",
    setScores: [],
    side1Players: ["도미노"],
    side2Players: ["야닉 시너"],
    currentUserSide: 1,
    createdAt: "2026-03-06T10:00:00.000Z",
    ...input,
  };
}

describe("filterMatchesByDateAndOpponent", () => {
  const matches: MatchSummary[] = [
    makeMatch({ id: "m1", playedAt: "2026-03-06T12:00:00.000Z" }),
    makeMatch({
      id: "m2",
      playedAt: "2026-03-05T12:00:00.000Z",
      side1Players: ["알카라스"],
      side2Players: ["조코비치"],
    }),
  ];

  it("날짜로 필터링한다", () => {
    const result = filterMatchesByDateAndOpponent({
      matches,
      playedOn: "2026-03-06",
      opponentQuery: "",
    });

    expect(result.map((match) => match.id)).toEqual(["m1"]);
  });

  it("상대 이름으로 필터링한다", () => {
    const result = filterMatchesByDateAndOpponent({
      matches,
      playedOn: "",
      opponentQuery: "조코",
    });

    expect(result.map((match) => match.id)).toEqual(["m2"]);
  });

  it("날짜+상대 조건을 동시에 적용한다", () => {
    const result = filterMatchesByDateAndOpponent({
      matches,
      playedOn: "2026-03-06",
      opponentQuery: "시너",
    });

    expect(result.map((match) => match.id)).toEqual(["m1"]);
  });
});
