import type { MatchSummary, SetScore } from "@/features/matches/types/match";

export function isRoundComplete(score: SetScore) {
  const target = score.gamesToWin ?? 6;
  const winner = Math.max(score.side1, score.side2);
  const loser = Math.min(score.side1, score.side2);

  if (winner < target) return false;
  if (winner === target && winner - loser >= 2) return true;
  return winner === target + 1 && loser === target;
}

export function hasIncompleteRound(setScores: SetScore[]) {
  return setScores.some((score) => !isRoundComplete(score));
}

export function summarizeOutcome(setScores: SetScore[]) {
  let side1Wins = 0;
  let side2Wins = 0;

  for (const score of setScores) {
    if (score.side1 > score.side2) side1Wins += 1;
    else if (score.side2 > score.side1) side2Wins += 1;
  }

  return { side1Wins, side2Wins };
}

export function gameScoreSummary(setScores: SetScore[]) {
  return setScores.map((score) => `${score.side1}-${score.side2}`).join(", ");
}

export function compactScoreSummary(match: MatchSummary) {
  if (match.setScores.length === 0) return match.scoreSummary;
  const { side1Wins, side2Wins } = summarizeOutcome(match.setScores);
  return `${side1Wins}:${side2Wins}`;
}

export function isMatchScoreConfirmed(status: MatchSummary["status"]) {
  return status === "confirmed";
}

export function resultMeta(match: MatchSummary, setScores: SetScore[]) {
  if (match.status !== "confirmed") {
    return {
      label: "미확정",
      badgeVariant: "warning" as const,
      listBgClass: "bg-background",
    };
  }

  const outcome = summarizeOutcome(setScores);
  if (match.currentUserSide === null) {
    return {
      label: "기록",
      badgeVariant: "default" as const,
      listBgClass: "bg-background",
    };
  }

  const mySide = match.currentUserSide;
  const myWins = mySide === 1 ? outcome.side1Wins : outcome.side2Wins;
  const opponentWins = mySide === 1 ? outcome.side2Wins : outcome.side1Wins;

  if (myWins === opponentWins) {
    return {
      label: "무",
      badgeVariant: "warning" as const,
      listBgClass: "bg-gray-50",
    };
  }

  if (myWins > opponentWins) {
    return {
      label: "승",
      badgeVariant: "success" as const,
      listBgClass: "bg-[var(--green-light)]",
    };
  }

  return {
    label: "패",
    badgeVariant: "destructive" as const,
    listBgClass: "bg-[var(--red-light)]",
  };
}
