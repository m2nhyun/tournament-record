import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MatchStatusBadge } from "@/features/matches/components/match-status-badge";
import type { MatchSummary, SetScore } from "@/features/matches/types/match";

type MatchCardProps = {
  match: MatchSummary;
  viewMode?: "card" | "list";
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

function resultMeta(match: MatchSummary, setScores: SetScore[]) {
  const outcome = summarizeOutcome(setScores);
  const mySide = match.currentUserSide ?? 1;
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

export function MatchCard({ match, viewMode = "card" }: MatchCardProps) {
  const team1 = match.side1Players.join(" · ");
  const team2 = match.side2Players.join(" · ");
  const hasInProgressRound = match.setScores.some((s) => !isRoundComplete(s));
  const outcome = summarizeOutcome(match.setScores);
  const scoreSummary = gameScoreSummary(match.setScores);
  const result = resultMeta(match, match.setScores);
  const isList = viewMode === "list";
  const compactScore =
    match.setScores.length > 0
      ? `${outcome.side1Wins}:${outcome.side2Wins}`
      : match.scoreSummary;

  if (isList) {
    return (
      <Link href={`/clubs/${match.clubId}/matches/${match.id}`} className="block">
        <article
          className={[
            "rounded-xl border px-4 py-3 shadow-[0_2px_10px_rgba(15,15,15,0.05)] transition-colors active:opacity-95",
            `${result.listBgClass} hover:brightness-[0.99]`,
          ].join(" ")}
        >
          <p className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
            <span className="truncate font-medium">{team1 || "팀 A"}</span>
            <span className="font-mono text-sm font-semibold">{compactScore}</span>
            <span className="truncate text-right font-medium">{team2 || "팀 B"}</span>
          </p>
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/clubs/${match.clubId}/matches/${match.id}`} className="block">
        <article
          className={[
            "rounded-xl border bg-card px-4 py-3 shadow-[0_2px_10px_rgba(15,15,15,0.05)] transition-colors hover:bg-accent/50 active:opacity-95",
          ].join(" ")}
        >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant={result.badgeVariant} className="px-1.5 py-0">
                  {result.label}
                </Badge>
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
                    <p className="truncate font-medium">{team1 || "팀 A"}</p>
                    <p
                      className={[
                        "font-mono font-semibold",
                        "text-base text-[var(--brand)]",
                      ].join(" ")}
                    >
                      {outcome.side1Wins} : {outcome.side2Wins}
                    </p>
                    <p className="truncate text-right font-medium">
                      {team2 || "팀 B"}
                    </p>
                  </div>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    게임 스코어: {scoreSummary}
                  </p>
                </div>
              ) : null}
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </div>

          {match.setScores.length > 0 ? null : (
            <p className="font-mono text-sm font-semibold text-[var(--brand)]">
              {match.scoreSummary}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
