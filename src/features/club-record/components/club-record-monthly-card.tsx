"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Trophy } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { AppBar } from "@/components/layout/app-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClubRecordMonthlyCard } from "@/features/club-record/hooks/use-club-record-monthly-card";
import type { ClubRecordMonthlyCardEntry } from "@/features/club-record/types/history";

type ClubRecordMonthlyCardViewProps = {
  clubId: string;
};

function formatWinRate(value: number) {
  return `${Math.round(value)}%`;
}

function sortEntries(entries: ClubRecordMonthlyCardEntry[]) {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (right.entry.wins !== left.entry.wins) {
        return right.entry.wins - left.entry.wins;
      }

      if (right.entry.winRate !== left.entry.winRate) {
        return right.entry.winRate - left.entry.winRate;
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

export function ClubRecordMonthlyCardView({
  clubId,
}: ClubRecordMonthlyCardViewProps) {
  const {
    entries,
    loading,
    error,
    monthLabel,
    isCurrentMonth,
    canGoNext,
    refresh,
    goToPreviousMonth,
    goToNextMonth,
  } = useClubRecordMonthlyCard(clubId);
  const hasResolvedOnceRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!loading) {
    hasResolvedOnceRef.current = true;
  }

  const sortedEntries = useMemo(() => sortEntries(entries), [entries]);
  const topEntry = sortedEntries[0] ?? null;
  const totalWins = useMemo(
    () => sortedEntries.reduce((sum, entry) => sum + entry.wins, 0),
    [sortedEntries],
  );
  const isUpdating = loading && hasResolvedOnceRef.current;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading && !hasResolvedOnceRef.current) {
    return <LoadingSpinner title="로딩 중" message="월간 공개 카드를 불러오는 중..." />;
  }

  return (
    <div className="space-y-4">
      <AppBar
        title="월간 공개 카드"
        showBack
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing || loading}
          >
            <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-4">
        {error ? <StatusBox type="error" message={error} /> : null}

        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-[var(--brand)]" />
              <h1 className="text-base font-semibold">월간 공개 카드</h1>
              {isCurrentMonth ? <Badge variant="brand">이번 달</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              선택한 달의 확정 경기 기준 클럽 공개 전적입니다.
            </p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>취소되거나 숨긴 이벤트 결과는 포함하지 않습니다.</p>
              <p>정렬 기준은 승수, 승률, 랭킹순입니다.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={goToPreviousMonth}
            disabled={loading}
          >
            <ChevronLeft className="size-4" />
            이전 달
          </Button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold">{monthLabel}</p>
            <p className="text-xs text-muted-foreground">확정 경기 전적</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={goToNextMonth}
            disabled={!canGoNext || loading}
          >
            다음 달
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {isUpdating ? (
          <StatusBox type="info" message="월간 공개 카드를 갱신하는 중입니다." />
        ) : null}

        {!loading && sortedEntries.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="월간 카드 데이터가 없습니다."
            description="확정된 경기 결과가 쌓이면 월간 공개 카드가 표시됩니다."
          />
        ) : null}

        {!loading && sortedEntries.length > 0 ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">대상 인원</p>
                <p className="mt-1 text-lg font-semibold">{sortedEntries.length}명</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">누적 승수</p>
                <p className="mt-1 text-lg font-semibold">{totalWins}승</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">현재 1위</p>
                <p className="mt-1 truncate text-lg font-semibold">
                  {topEntry?.nickname ?? "-"}
                </p>
              </div>
            </div>

            <section className="space-y-3 md:hidden">
              {sortedEntries.map((entry, index) => (
                <Card key={entry.clubMemberId}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge variant={index < 3 ? "brand" : "default"}>
                          {index + 1}위
                        </Badge>
                        <p className="mt-2 break-words text-base font-semibold">
                          {entry.nickname}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">승률</p>
                        <p className="font-mono text-lg font-semibold text-[var(--brand)]">
                          {formatWinRate(entry.winRate)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg border bg-muted/20 px-2 py-2">
                        <p className="text-xs text-muted-foreground">승</p>
                        <p className="font-semibold">{entry.wins}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-2 py-2">
                        <p className="text-xs text-muted-foreground">패</p>
                        <p className="font-semibold">{entry.losses}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-2 py-2">
                        <p className="text-xs text-muted-foreground">무</p>
                        <p className="font-semibold">{entry.draws}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <Card className="hidden md:block">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left text-muted-foreground">
                      <th className="px-3 py-3 text-center font-medium">순위</th>
                      <th className="px-3 py-3 font-medium">이름</th>
                      <th className="px-3 py-3 text-center font-medium">승</th>
                      <th className="px-3 py-3 text-center font-medium">패</th>
                      <th className="px-3 py-3 text-center font-medium">무</th>
                      <th className="px-3 py-3 text-center font-medium">승률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry, index) => (
                      <tr key={entry.clubMemberId} className="border-b last:border-b-0">
                        <td className="px-3 py-3 text-center">
                          <Badge variant={index < 3 ? "brand" : "default"}>
                            {index + 1}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 font-medium">{entry.nickname}</td>
                        <td className="px-3 py-3 text-center">{entry.wins}</td>
                        <td className="px-3 py-3 text-center">{entry.losses}</td>
                        <td className="px-3 py-3 text-center">{entry.draws}</td>
                        <td className="px-3 py-3 text-center">
                          {formatWinRate(entry.winRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
