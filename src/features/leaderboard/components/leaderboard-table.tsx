"use client";

import { Medal } from "lucide-react";

import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { useLeaderboard } from "@/features/leaderboard/hooks/use-leaderboard";
import type { LeaderboardEntry } from "@/features/leaderboard/types/leaderboard";
import { AppBar } from "@/components/layout/app-bar";

type LeaderboardViewProps = {
  clubId: string;
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
      {rank}
    </span>
  );
}

function MobileCard({
  entry,
  rank,
}: {
  entry: LeaderboardEntry;
  rank: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <RankBadge rank={rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.nickname}</p>
        <p className="text-xs text-muted-foreground">
          {entry.totalMatches}경기 · 승률 {entry.winRate}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-[var(--brand)]">
          {entry.wins}승 {entry.losses}패
        </p>
      </div>
    </div>
  );
}

export function LeaderboardView({ clubId }: LeaderboardViewProps) {
  const { entries, loading, error } = useLeaderboard(clubId);

  if (loading) {
    return <LoadingSpinner title="로딩 중" message="리더보드를 불러오는 중..." />;
  }

  return (
    <div className="space-y-2">
      <AppBar
        title="리더보드"
        showBack={false}
      />
      <div className="space-y-4 px-4">
        {error ? <StatusBox type="error" message={error} /> : null}

        {!error && entries.length === 0 ? (
          <EmptyState
            icon={Medal}
            title="아직 리더보드 데이터가 없습니다."
            description="경기를 기록하면 자동으로 집계됩니다."
          />
        ) : null}

        {/* Mobile: card layout */}
        {entries.length > 0 ? (
          <div className="space-y-2 sm:hidden">
            {entries.map((entry, i) => (
              <MobileCard key={entry.clubMemberId} entry={entry} rank={i + 1} />
            ))}
          </div>
        ) : null}

        {/* Desktop: table layout */}
        {entries.length > 0 ? (
          <div className="hidden overflow-hidden rounded-xl border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    순위
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    선수
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    승
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    패
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    경기
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    승률
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.clubMemberId} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-3 font-medium">{entry.nickname}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[var(--brand)]">
                      {entry.wins}
                    </td>
                    <td className="px-4 py-3 text-center">{entry.losses}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {entry.totalMatches}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {entry.winRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
