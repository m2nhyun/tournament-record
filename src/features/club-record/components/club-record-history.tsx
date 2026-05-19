"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Filter,
  History,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { AppBar } from "@/components/layout/app-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClubRecordHistory } from "@/features/club-record/hooks/use-club-record-history";
import type { ClubRecordHistoryEntry } from "@/features/club-record/types/history";

type ClubRecordHistoryViewProps = {
  clubId: string;
};

type ViewMode = "card" | "list";

const PAGE_SIZE = 16;

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function toDateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getResultBadge(result: ClubRecordHistoryEntry["result"]) {
  if (result === "win") {
    return {
      label: "승",
      variant: "success" as const,
      tone: "bg-[var(--color-green-light)]",
    };
  }

  if (result === "loss") {
    return {
      label: "패",
      variant: "destructive" as const,
      tone: "bg-[var(--color-red-light)]",
    };
  }

  return { label: "무", variant: "default" as const, tone: "bg-muted/20" };
}

function getMatchType(entry: ClubRecordHistoryEntry) {
  const playerCount = entry.teamNames.length + entry.opponentNames.length;
  return playerCount > 2 ? "복식" : "단식";
}

function NameText({
  names,
  emptyLabel,
  highlightFirst = false,
}: {
  names: string[];
  emptyLabel: string;
  highlightFirst?: boolean;
}) {
  if (names.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <span>
      {names.map((name, index) => (
        <Fragment key={`${name}-${index}`}>
          {index > 0 ? <span className="text-muted-foreground">, </span> : null}
          <span
            className={
              highlightFirst && index === 0
                ? "font-semibold text-[var(--color-player-highlight)]"
                : "font-medium text-foreground"
            }
          >
            {name}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

function MatchupLine({ entry }: { entry: ClubRecordHistoryEntry }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
      <p className="min-w-0 break-words text-right text-sm sm:text-base">
        <NameText
          names={entry.teamNames}
          emptyLabel="내 이름 정보 없음"
          highlightFirst
        />
      </p>
      <p className="font-mono text-lg font-semibold leading-none text-[var(--brand)]">
        {entry.scoreText || "결과 없음"}
      </p>
      <p className="min-w-0 break-words text-left text-sm sm:text-base">
        <NameText names={entry.opponentNames} emptyLabel="상대 정보 없음" />
      </p>
    </div>
  );
}

function matchesFilter(
  entry: ClubRecordHistoryEntry,
  dateFilter: string,
  opponentFilter: string,
) {
  if (dateFilter && toDateInputValue(entry.eventDate) !== dateFilter) {
    return false;
  }

  const normalizedOpponent = opponentFilter.trim().toLowerCase();
  if (!normalizedOpponent) return true;

  return entry.opponentNames.some((name) =>
    name.toLowerCase().includes(normalizedOpponent),
  );
}

function HistoryCard({
  clubId,
  entry,
}: {
  clubId: string;
  entry: ClubRecordHistoryEntry;
}) {
  const resultBadge = getResultBadge(entry.result);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>
            <Badge variant="brand">{getMatchType(entry)}</Badge>
            <Badge variant="default">확정</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatEventDate(entry.eventDate)}</p>
        </div>

        <div className={`rounded-xl border px-3 py-3 ${resultBadge.tone}`}>
          <MatchupLine entry={entry} />
        </div>

        <Button size="sm" variant="outline" asChild>
          <Link href={`/clubs/${clubId}/club-record/${entry.eventId}`}>
            이벤트 보기
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryListItem({
  clubId,
  entry,
}: {
  clubId: string;
  entry: ClubRecordHistoryEntry;
}) {
  const resultBadge = getResultBadge(entry.result);

  return (
    <Link
      href={`/clubs/${clubId}/club-record/${entry.eventId}`}
      className={`block rounded-xl border px-3 py-3 ${resultBadge.tone}`}
    >
      <MatchupLine entry={entry} />
    </Link>
  );
}

export function ClubRecordHistoryView({
  clubId,
}: ClubRecordHistoryViewProps) {
  const { entries, loading, error, refresh } = useClubRecordHistory(clubId);
  const hasResolvedOnceRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [opponentFilter, setOpponentFilter] = useState("");
  const [visibleCountByKey, setVisibleCountByKey] = useState<Record<string, number>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  if (!loading) {
    hasResolvedOnceRef.current = true;
  }

  const filteredEntries = useMemo(
    () => entries.filter((entry) => matchesFilter(entry, dateFilter, opponentFilter)),
    [dateFilter, entries, opponentFilter],
  );

  const resetKey = `${dateFilter}-${opponentFilter}-${viewMode}`;
  const visibleCount = visibleCountByKey[resetKey] ?? PAGE_SIZE;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= filteredEntries.length) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        const first = observerEntries[0];
        if (!first?.isIntersecting) return;
        setVisibleCountByKey((prev) => ({
          ...prev,
          [resetKey]: Math.min((prev[resetKey] ?? PAGE_SIZE) + PAGE_SIZE, filteredEntries.length),
        }));
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredEntries.length, resetKey, visibleCount]);

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount],
  );
  const hasMore = visibleCount < filteredEntries.length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading && !hasResolvedOnceRef.current) {
    return <LoadingSpinner title="로딩 중" message="내 기록을 불러오는 중..." />;
  }

  if (error && entries.length === 0) {
    return (
      <div className="space-y-4">
        <AppBar title="내 기록" showBack />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox type="error" message={error} />
          <Button variant="outline" onClick={() => void handleRefresh()}>
            다시 불러오기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AppBar
        title="내 기록"
        showBack
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
          >
            <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-4">
        {error ? <StatusBox type="error" message={error} /> : null}

        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <History className="size-4 text-[var(--brand)]" />
              <h1 className="text-base font-semibold">내 경기 기록</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              클럽 레코드에서 확정된 내 경기만 모아 봅니다.
            </p>
            <p className="text-xs text-muted-foreground">
              내 팀과 상대 기준으로 지난 결과를 확인할 수 있습니다.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-xl border bg-muted/20 p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "card" ? "default" : "secondary"}
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="size-4" />
              카드
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "secondary"}
              onClick={() => setViewMode("list")}
            >
              <List className="size-4" />
              리스트
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFilterOpen((current) => !current)}
          >
            <Filter className="size-4" />
            필터
          </Button>
        </div>

        {filterOpen ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="club-record-history-date-filter">경기일</Label>
                <Input
                  id="club-record-history-date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="club-record-history-opponent-filter">상대 이름</Label>
                <Input
                  id="club-record-history-opponent-filter"
                  value={opponentFilter}
                  onChange={(event) => setOpponentFilter(event.target.value)}
                  placeholder="상대 이름 검색"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setDateFilter("");
                  setOpponentFilter("");
                }}
              >
                필터 초기화
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            전체 {entries.length}경기 · 표시 {visibleEntries.length}/{filteredEntries.length}경기
          </p>
          {isRefreshing ? (
            <p className="text-xs text-muted-foreground">새로고침 중...</p>
          ) : null}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="아직 확정된 내 기록이 없습니다."
            description="결과가 확정되면 여기에 승패가 쌓입니다."
          />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="조건에 맞는 기록이 없습니다."
            description="날짜나 상대 이름을 다시 확인해보세요."
          />
        ) : (
          <section className="space-y-3">
            {visibleEntries.map((entry) =>
              viewMode === "card" ? (
                <HistoryCard key={entry.matchId} clubId={clubId} entry={entry} />
              ) : (
                <HistoryListItem key={entry.matchId} clubId={clubId} entry={entry} />
              ),
            )}
            {hasMore ? (
              <div ref={sentinelRef} className="h-4" aria-hidden="true" />
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
