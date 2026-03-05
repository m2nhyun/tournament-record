import Link from "next/link";
import { ChevronRight, User, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  const scoreSummary = gameScoreSummary(match.setScores);
  const side1Result =
    outcome.side1Wins === outcome.side2Wins
      ? "draw"
      : outcome.side1Wins > outcome.side2Wins
        ? "win"
        : "lose";
  const side2Result =
    outcome.side1Wins === outcome.side2Wins
      ? "draw"
      : outcome.side2Wins > outcome.side1Wins
        ? "win"
        : "lose";

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
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{team1 || "팀 A"}</span>
                      <Badge
                        variant={
                          side1Result === "win"
                            ? "success"
                            : side1Result === "lose"
                              ? "destructive"
                              : "warning"
                        }
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {side1Result === "win"
                          ? "승"
                          : side1Result === "lose"
                            ? "패"
                            : "무"}
                      </Badge>
                    </div>
                    <p className="font-mono text-base font-semibold text-[var(--brand)]">
                      {outcome.side1Wins} : {outcome.side2Wins}
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      <Badge
                        variant={
                          side2Result === "win"
                            ? "success"
                            : side2Result === "lose"
                              ? "destructive"
                              : "warning"
                        }
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {side2Result === "win"
                          ? "승"
                          : side2Result === "lose"
                            ? "패"
                            : "무"}
                      </Badge>
                      <span className="font-medium">{team2 || "팀 B"}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    게임 스코어: {scoreSummary}
                  </p>
                </div>
              ) : null}
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </div>

          {match.setScores.length > 0 ? (
            null
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
