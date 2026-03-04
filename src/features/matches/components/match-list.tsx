import { MatchCard } from "@/features/matches/components/match-card";
import type { MatchSummary } from "@/features/matches/types/match";

type MatchListProps = {
  matches: MatchSummary[];
};

type DateGroup = {
  label: string;
  matches: MatchSummary[];
};

function groupByDate(matches: MatchSummary[]): DateGroup[] {
  const groups = new Map<string, MatchSummary[]>();

  for (const match of matches) {
    const dateKey = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(match.playedAt));

    const existing = groups.get(dateKey) ?? [];
    existing.push(match);
    groups.set(dateKey, existing);
  }

  return Array.from(groups.entries()).map(([label, matches]) => ({
    label,
    matches,
  }));
}

export function MatchList({ matches }: MatchListProps) {
  const groups = groupByDate(matches);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {group.label}
          </h3>
          <div className="grid gap-2">
            {group.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
