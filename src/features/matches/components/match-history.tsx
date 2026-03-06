"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  History,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { MatchList } from "@/features/matches/components/match-list";
import { useMatchList } from "@/features/matches/hooks/use-match-list";
import { AppBar } from "@/components/layout/app-bar";

type MatchHistoryViewProps = {
  clubId: string;
};

export function MatchHistoryView({ clubId }: MatchHistoryViewProps) {
  const { matches, loading, error } = useMatchList(clubId);
  const [playedOn, setPlayedOn] = useState("");
  const [opponentQuery, setOpponentQuery] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const filteredMatches = useMemo(() => {
    const opponent = opponentQuery.trim().toLowerCase();
    return matches.filter((match) => {
      if (playedOn) {
        const date = new Date(match.playedAt);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        if (dateKey !== playedOn) return false;
      }

      if (!opponent) return true;
      const names = [...match.side1Players, ...match.side2Players]
        .join(" ")
        .toLowerCase();
      return names.includes(opponent);
    });
  }, [matches, opponentQuery, playedOn]);

  if (loading) {
    return <LoadingSpinner title="로딩 중" message="경기 기록을 불러오는 중..." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <AppBar
        title="경기 히스토리"
        showBack
        onBack={() => {
          window.location.href = `/clubs/${clubId}`;
        }}
      />
      <div className="space-y-3">
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

        {matches.length > 0 ? (
          <section className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "card" ? "default" : "outline"}
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="size-4" />
                  카드
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "default" : "outline"}
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
                onClick={() => setIsFilterOpen((prev) => !prev)}
              >
                필터
                {isFilterOpen ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            </div>

            {isFilterOpen ? (
              <div className="rounded-xl border bg-card p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border px-3">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={playedOn}
                      onChange={(event) => setPlayedOn(event.target.value)}
                      className="border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border px-3">
                    <Search className="size-4 text-muted-foreground" />
                    <Input
                      type="search"
                      value={opponentQuery}
                      onChange={(event) => setOpponentQuery(event.target.value)}
                      placeholder="상대 이름 검색"
                      className="border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {filteredMatches.length === 0 ? (
              <EmptyState
                icon={History}
                title="조건에 맞는 경기가 없습니다."
                description="날짜 또는 상대 이름을 조정해보세요."
              />
            ) : (
              <MatchList
                key={`${viewMode}:${playedOn}:${opponentQuery}:${filteredMatches.length}`}
                matches={filteredMatches}
                viewMode={viewMode}
              />
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
