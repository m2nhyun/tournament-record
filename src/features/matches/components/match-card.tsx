import Link from "next/link";
import { ChevronRight, User, Users } from "lucide-react";

import { MatchStatusBadge } from "@/features/matches/components/match-status-badge";
import type { MatchSummary } from "@/features/matches/types/match";

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

export function MatchCard({ match }: MatchCardProps) {
  const TypeIcon = match.matchType === "singles" ? User : Users;

  return (
    <Link href={`/clubs/${match.clubId}/matches/${match.id}`} className="block">
      <article className="rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <TypeIcon className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {match.matchType === "singles" ? "단식" : "복식"}
              </span>
              <MatchStatusBadge status={match.status} />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">
                {match.side1Players.join(" · ")}
              </span>
              <span className="text-xs text-muted-foreground">vs</span>
              <span className="font-semibold">
                {match.side2Players.join(" · ")}
              </span>
            </div>

            {match.scoreSummary ? (
              <p className="font-mono text-sm font-semibold text-[var(--brand)]">
                {match.scoreSummary}
              </p>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              {formatDate(match.playedAt)}
            </p>
          </div>
          <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
        </div>
      </article>
    </Link>
  );
}
