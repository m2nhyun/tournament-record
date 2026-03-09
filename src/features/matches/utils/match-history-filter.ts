import type { MatchSummary } from "@/features/matches/types/match";

type MatchFilterInput = {
  matches: MatchSummary[];
  playedOn: string;
  opponentQuery: string;
};

function matchDateKey(value: string) {
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function filterMatchesByDateAndOpponent({
  matches,
  playedOn,
  opponentQuery,
}: MatchFilterInput) {
  const opponent = opponentQuery.trim().toLowerCase();

  return matches.filter((match) => {
    if (playedOn && matchDateKey(match.playedAt) !== playedOn) return false;
    if (!opponent) return true;

    const names = [...match.side1Players, ...match.side2Players]
      .join(" ")
      .toLowerCase();
    return names.includes(opponent);
  });
}

