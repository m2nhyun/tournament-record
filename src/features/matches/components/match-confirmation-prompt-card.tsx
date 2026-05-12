"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePendingMatchConfirmations } from "@/features/matches/hooks/use-pending-match-confirmations";

type MatchConfirmationPromptCardProps = {
  clubId: string;
};

function formatPlayedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

export function MatchConfirmationPromptCard({
  clubId,
}: MatchConfirmationPromptCardProps) {
  const { items, loading, error } = usePendingMatchConfirmations(clubId);

  if (loading || error || items.length === 0) return null;

  const visibleItems = items.slice(0, 3);
  const extraCount = items.length - visibleItems.length;

  return (
    <Card className="border-amber-200 bg-amber-50/70 shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-amber-800" />
              <h2 className="text-sm font-semibold text-amber-950">
                확인할 경기 {items.length}개
              </h2>
            </div>
            <p className="text-xs text-amber-900/80">
              상대가 저장한 경기 결과를 확인하면 기록이 확정됩니다.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/clubs/${clubId}/history`}>
              히스토리
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-2">
          {visibleItems.map((item) => (
            <Link
              key={item.id}
              href={`/clubs/${clubId}/matches/${item.matchId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-background px-3 py-2 transition-colors hover:bg-amber-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.matchType === "singles" ? "단식" : "복식"} 경기 확인
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPlayedAt(item.playedAt)}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-amber-800">
                확인
              </span>
            </Link>
          ))}
          {extraCount > 0 ? (
            <p className="px-1 text-xs text-amber-900/70">
              외 {extraCount}개 요청은 히스토리에서 확인할 수 있습니다.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
