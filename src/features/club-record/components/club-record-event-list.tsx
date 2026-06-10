"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, PlusCircle, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { AppBar } from "@/components/layout/app-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClubRecordDashboard } from "@/features/club-record/hooks/use-club-record-dashboard";
import type { ClubRecordDashboardEventSummary } from "@/features/club-record/types/dashboard";

type ClubRecordEventListViewProps = {
  clubId: string;
};

function formatDateLabel(event: ClubRecordDashboardEventSummary) {
  const date = new Date(event.eventDate);
  return date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventStatusBadge({
  status,
  assignmentDirty,
}: Pick<ClubRecordDashboardEventSummary, "status" | "assignmentDirty">) {
  const statusLabelMap = {
    draft: "초안",
    open: "오픈",
    in_progress: "진행 중",
    completed: "완료",
    cancelled: "취소",
  } as const;

  const variant =
    status === "completed"
      ? "success"
      : status === "cancelled"
        ? "destructive"
        : status === "in_progress"
          ? "brand"
          : "default";

  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant}>{statusLabelMap[status]}</Badge>
      {assignmentDirty ? <Badge variant="warning">변경됨</Badge> : null}
    </div>
  );
}

function EventListCard({
  clubId,
  event,
  highlight = false,
}: {
  clubId: string;
  event: ClubRecordDashboardEventSummary;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-[var(--brand)]/25 bg-[var(--brand)]/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">{formatDateLabel(event)}</p>
            <p className="truncate text-base font-semibold">
              {event.title?.trim() || "데일리 매치"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatTimeLabel(event.startsAt)} - {formatTimeLabel(event.endsAt)}
            </p>
          </div>
          <EventStatusBadge status={event.status} assignmentDirty={event.assignmentDirty} />
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/clubs/${clubId}/club-record/${event.id}`}>
              열기
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClubRecordEventListView({
  clubId,
}: ClubRecordEventListViewProps) {
  const { dashboard, loading, error, refresh } = useClubRecordDashboard(clubId);

  if (loading) {
    return <LoadingSpinner title="로딩 중" message="이벤트를 불러오는 중..." />;
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-4">
        <AppBar title="이벤트" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox type="error" message={error ?? "이벤트를 불러오지 못했습니다."} />
          <Button variant="outline" onClick={() => void refresh()}>
            다시 불러오기
          </Button>
        </div>
      </div>
    );
  }

  const { access, currentEvent, upcomingEvents } = dashboard;
  const hasEvents = Boolean(currentEvent) || upcomingEvents.length > 0;

  return (
    <div className="space-y-4">
      <AppBar
        title="이벤트"
        actions={
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      <div className="space-y-5 px-4 pb-24 pt-4">
        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[var(--brand)]" />
              <h1 className="text-base font-semibold">데일리 매치 이벤트</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              현재 진행 중이거나 예정된 데일리 매치를 확인합니다.
            </p>
            {access.capabilities.canCreateEvent ? (
              <Button size="sm" asChild>
                <Link href={`/clubs/${clubId}/club-record/new`}>
                  <PlusCircle className="size-4" />
                  새 이벤트
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {!hasEvents ? (
          <EmptyState
            icon={CalendarDays}
            title="진행 중인 이벤트가 없습니다."
            description="이벤트가 생성되면 여기에서 바로 열 수 있습니다."
          />
        ) : null}

        {currentEvent ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">현재 이벤트</h2>
            <EventListCard clubId={clubId} event={currentEvent} highlight />
          </section>
        ) : null}

        {upcomingEvents.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">다음 이벤트</h2>
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <EventListCard key={event.id} clubId={clubId} event={event} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
