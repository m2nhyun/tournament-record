"use client";

import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { MatchList } from "@/features/matches/components/match-list";
import { useMatchList } from "@/features/matches/hooks/use-match-list";

type MatchHistoryViewProps = {
  clubId: string;
};

export function MatchHistoryView({ clubId }: MatchHistoryViewProps) {
  const { matches, loading, error } = useMatchList(clubId);

  if (loading) {
    return <LoadingSpinner message="경기 기록을 불러오는 중..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${clubId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <History className="size-5" />
          경기 히스토리
        </h1>
      </div>

      {error ? <StatusBox type="error" message={error} /> : null}

      {!error && matches.length === 0 ? (
        <EmptyState
          icon={History}
          title="아직 기록된 경기가 없습니다."
          description="새 경기를 기록해보세요."
          actionLabel="새 경기 기록"
          onAction={() => {
            window.location.href = `/clubs/${clubId}/matches/new`;
          }}
        />
      ) : null}

      {matches.length > 0 ? <MatchList matches={matches} /> : null}
    </div>
  );
}
