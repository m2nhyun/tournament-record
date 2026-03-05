"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MatchCard } from "@/features/matches/components/match-card";
import type { MatchSummary } from "@/features/matches/types/match";

type MatchListProps = {
  matches: MatchSummary[];
  viewMode: "card" | "list";
};

const PAGE_SIZE = 16;

export function MatchList({ matches, viewMode }: MatchListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= matches.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, matches.length));
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [matches.length, visibleCount]);

  const visibleMatches = useMemo(
    () => matches.slice(0, visibleCount),
    [matches, visibleCount],
  );
  const hasMore = visibleCount < matches.length;

  return (
    <div className="space-y-2">
      {visibleMatches.map((match) => (
        <MatchCard key={match.id} match={match} viewMode={viewMode} />
      ))}

      {hasMore ? (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground">
          경기 기록을 더 불러오는 중...
        </div>
      ) : null}
    </div>
  );
}
