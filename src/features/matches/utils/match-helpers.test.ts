import { describe, expect, it } from "vitest";

import {
  compactScoreSummary,
  hasIncompleteRound,
  gameScoreSummary,
  isMatchScoreConfirmed,
  isRoundComplete,
  resultMeta,
  summarizeOutcome,
} from "./match-helpers";
import type { MatchSummary, SetScore } from "../types/match";

function makeMatch(input: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: "m1",
    clubId: "c1",
    matchType: "singles",
    status: "submitted",
    playedAt: "2026-03-06T10:00:00.000Z",
    scoreSummary: "기록 없음",
    setScores: [],
    side1Players: ["A"],
    side2Players: ["B"],
    currentUserSide: 1,
    createdAt: "2026-03-06T10:00:00.000Z",
    ...input,
  };
}

describe("match-helpers", () => {
  it("정상 게임 종료를 판정한다", () => {
    expect(isRoundComplete({ set: 1, side1: 6, side2: 4, gamesToWin: 6 })).toBe(true);
    expect(isRoundComplete({ set: 1, side1: 7, side2: 6, gamesToWin: 6 })).toBe(true);
    expect(isRoundComplete({ set: 1, side1: 5, side2: 5, gamesToWin: 6 })).toBe(false);
    expect(isRoundComplete({ set: 1, side1: 4, side2: 2, gamesToWin: 4 })).toBe(true);
    expect(isRoundComplete({ set: 1, side1: 5, side2: 4, gamesToWin: 4 })).toBe(true);
  });

  it("미완료 게임 포함 여부를 판정한다", () => {
    expect(
      hasIncompleteRound([
        { set: 1, side1: 6, side2: 4, gamesToWin: 6 },
        { set: 2, side1: 3, side2: 2, gamesToWin: 6 },
      ]),
    ).toBe(true);
    expect(
      hasIncompleteRound([{ set: 1, side1: 4, side2: 2, gamesToWin: 4 }]),
    ).toBe(false);
  });

  it("세트 배열에서 승수 요약과 게임 문자열을 만든다", () => {
    const setScores: SetScore[] = [
      { set: 1, side1: 6, side2: 4, gamesToWin: 6 },
      { set: 2, side1: 6, side2: 7, gamesToWin: 6 },
      { set: 3, side1: 6, side2: 3, gamesToWin: 6 },
    ];

    expect(summarizeOutcome(setScores)).toEqual({ side1Wins: 2, side2Wins: 1 });
    expect(gameScoreSummary(setScores)).toBe("6-4, 6-7, 6-3");
  });

  it("내 사이드 기준 승패 결과를 정확히 계산한다", () => {
    const setScores: SetScore[] = [
      { set: 1, side1: 6, side2: 4, gamesToWin: 6 },
      { set: 2, side1: 6, side2: 3, gamesToWin: 6 },
    ];

    const side1Win = resultMeta(
      makeMatch({ currentUserSide: 1, status: "confirmed" }),
      setScores,
    );
    const side2Lose = resultMeta(
      makeMatch({ currentUserSide: 2, status: "confirmed" }),
      setScores,
    );

    expect(side1Win.label).toBe("승");
    expect(side2Lose.label).toBe("패");
  });

  it("내가 참가하지 않은 경기는 중립 표기로 처리한다", () => {
    const setScores: SetScore[] = [
      { set: 1, side1: 6, side2: 4, gamesToWin: 6 },
      { set: 2, side1: 6, side2: 3, gamesToWin: 6 },
    ];

    const unrelated = resultMeta(
      makeMatch({ currentUserSide: null, status: "confirmed" }),
      setScores,
    );

    expect(unrelated.label).toBe("기록");
    expect(unrelated.listBgClass).toBe("bg-background");
  });

  it("미확정 경기는 중립 상태로 표시한다", () => {
    const pending = resultMeta(makeMatch({ status: "submitted" }), [
      { set: 1, side1: 6, side2: 4, gamesToWin: 6 },
    ]);
    const disputed = resultMeta(makeMatch({ status: "disputed" }), [
      { set: 1, side1: 4, side2: 6, gamesToWin: 6 },
    ]);

    expect(pending.label).toBe("미확정");
    expect(pending.listBgClass).toBe("bg-background");
    expect(disputed.label).toBe("미확정");
    expect(disputed.listBgClass).toBe("bg-background");
  });

  it("리스트 점수는 세트 결과 우선으로 표시한다", () => {
    const withSets = makeMatch({
      setScores: [
        { set: 1, side1: 6, side2: 4, gamesToWin: 6 },
        { set: 2, side1: 3, side2: 6, gamesToWin: 6 },
        { set: 3, side1: 6, side2: 2, gamesToWin: 6 },
      ],
      scoreSummary: "fallback",
    });

    const withoutSets = makeMatch({ setScores: [], scoreSummary: "3:0" });

    expect(compactScoreSummary(withSets)).toBe("2:1");
    expect(compactScoreSummary(withoutSets)).toBe("3:0");
  });

  it("확정 상태만 반영 대상으로 취급한다", () => {
    expect(isMatchScoreConfirmed("confirmed")).toBe(true);
    expect(isMatchScoreConfirmed("submitted")).toBe(false);
    expect(isMatchScoreConfirmed("disputed")).toBe(false);
  });
});
