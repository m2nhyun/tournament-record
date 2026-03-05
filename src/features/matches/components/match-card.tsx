import Link from "next/link";
import { ChevronRight, User, Users } from "lucide-react";

import { MatchStatusBadge } from "@/features/matches/components/match-status-badge";
import type { MatchSummary, SetScore } from "@/features/matches/types/match";

type MatchCardProps = {
  match: MatchSummary;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function isRoundComplete(score: SetScore) {
  const target = score.gamesToWin ?? 6;
  const winner = Math.max(score.side1, score.side2);
  const loser = Math.min(score.side1, score.side2);

  if (winner < target) return false;
  if (winner === target && winner - loser >= 2) return true;
  return winner === target + 1 && loser === target;
}

function formatGameCell(sideGames: number, point?: string) {
  if (!point || point === "0") return String(sideGames);
  return `${sideGames} (${point})`;
}

function summarizeOutcome(setScores: SetScore[]) {
  let side1Wins = 0;
  let side2Wins = 0;
  for (const s of setScores) {
    if (s.side1 > s.side2) side1Wins++;
    else if (s.side2 > s.side1) side2Wins++;
  }
  return { side1Wins, side2Wins };
}

function gameScoreSummary(setScores: SetScore[]) {
  return setScores.map((s) => `${s.side1}-${s.side2}`).join(", ");
}

export function MatchCard({ match }: MatchCardProps) {
  const TypeIcon = match.matchType === "singles" ? User : Users;
  const team1 = match.side1Players.join(" · ");
  const team2 = match.side2Players.join(" · ");
  const hasInProgressRound = match.setScores.some((s) => !isRoundComplete(s));
  const outcome = summarizeOutcome(match.setScores);
  const outcomeLabel =
    outcome.side1Wins === outcome.side2Wins
      ? "동률"
      : `승 ${outcome.side1Wins > outcome.side2Wins ? team1 || "팀 A" : team2 || "팀 B"} · 패 ${outcome.side1Wins > outcome.side2Wins ? team2 || "팀 B" : team1 || "팀 A"}`;
  const scoreSummary = gameScoreSummary(match.setScores);

  return (
    <Link href={`/clubs/${match.clubId}/matches/${match.id}`} className="block">
      <article className="rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <TypeIcon className="size-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {match.matchType === "singles" ? "단식" : "복식"}
                </span>
                <MatchStatusBadge status={match.status} />
                {hasInProgressRound ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    예외 기록
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(match.playedAt)}
              </p>
              {match.setScores.length > 0 ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {outcomeLabel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    게임 스코어: {scoreSummary}
                  </p>
                </div>
              ) : null}
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </div>

          {match.setScores.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                      게임
                    </th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                      {team1}
                    </th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                      {team2}
                    </th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {match.setScores.map((score) => {
                    const complete = isRoundComplete(score);
                    return (
                      <tr key={score.set} className="border-b last:border-0">
                        <td className="px-2 py-1.5 text-muted-foreground">
                          G{score.set}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold">
                          {formatGameCell(score.side1, score.side1Point)}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold">
                          {formatGameCell(score.side2, score.side2Point)}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-center ${complete ? "text-emerald-600" : "text-amber-600"}`}
                        >
                          {complete ? "완료" : "진행/중단"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-mono text-sm font-semibold text-[var(--brand)]">
              {match.scoreSummary}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
