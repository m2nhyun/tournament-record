"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Trophy } from "lucide-react";

import { AppBar } from "@/components/layout/app-bar";
import { ClubSwitcherAction } from "@/components/layout/club-switcher-action";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubRecordDashboard } from "@/features/club-record/hooks/use-club-record-dashboard";
import type { ClubRecordDashboardEventSummary } from "@/features/club-record/types/dashboard";

type ClubRecordDashboardViewProps = {
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

function formatMatchTimeRange(startsAt: string, endsAt: string) {
  const dayLabel = new Date(startsAt).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  return `${dayLabel} · ${formatTimeLabel(startsAt)} ~ ${formatTimeLabel(endsAt)}`;
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

function EventCard({
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

export function ClubRecordDashboardView({
  clubId,
}: ClubRecordDashboardViewProps) {
  const router = useRouter();
  const { dashboard, loading, error, refresh } = useClubRecordDashboard(clubId);

  if (loading) {
    return <LoadingSpinner title="로딩 중" message="club record를 불러오는 중..." />;
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-4">
        <AppBar title="클럽 레코드" showBack={false} actions={<ClubSwitcherAction />} />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox type="error" message={error ?? "club record를 불러오지 못했습니다."} />
          <Button variant="outline" onClick={() => void refresh()}>
            다시 불러오기
          </Button>
        </div>
      </div>
    );
  }

  const { access, currentEvent, upcomingEvents, monthlyCard, nextMatch } = dashboard;

  return (
    <div className="space-y-6">
      <AppBar title="클럽 레코드" showBack={false} actions={<ClubSwitcherAction />} />
      <div className="space-y-6 px-4">
        {currentEvent ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">진행 중인 이벤트가 있습니다.</p>
                <Badge variant={access.capabilities.canManageClubData ? "brand" : "default"}>
                  {access.roleLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href={`/clubs/${clubId}/club-record/${currentEvent.id}`}>
                    <CalendarDays className="size-4" />
                    현재 이벤트 열기
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {nextMatch ? (
          <Card className="border-[var(--player-highlight)]/40 bg-[var(--player-highlight)]/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">내 다음 경기</CardTitle>
                <Badge variant="brand">{nextMatch.courtNumber}번 코트</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMatchTimeRange(nextMatch.slotStartsAt, nextMatch.slotEndsAt)}
                {nextMatch.eventTitle ? ` · ${nextMatch.eventTitle}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">내 팀: </span>
                <span className="font-medium">
                  {(nextMatch.mySide === 1
                    ? nextMatch.teamOneNames
                    : nextMatch.teamTwoNames
                  ).join(", ") || "?"}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">상대: </span>
                <span className="font-medium">
                  {(nextMatch.mySide === 1
                    ? nextMatch.teamTwoNames
                    : nextMatch.teamOneNames
                  ).join(", ") || "?"}
                </span>
              </p>
              <Button size="sm" variant="outline" asChild className="mt-2">
                <Link
                  href={`/clubs/${clubId}/club-record/${nextMatch.eventId}`}
                >
                  이벤트 열기
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">현재 이벤트</h2>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              새로고침
            </Button>
          </div>
          {currentEvent ? (
            <EventCard clubId={clubId} event={currentEvent} highlight />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="활성 이벤트가 없습니다."
              description="이벤트가 생성되면 여기에서 바로 열 수 있습니다."
              actionLabel={
                access.capabilities.canCreateEvent ? "새 이벤트 만들기" : undefined
              }
              onAction={
                access.capabilities.canCreateEvent
                  ? () => router.push(`/clubs/${clubId}/club-record/new`)
                  : undefined
              }
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">다음 이벤트</h2>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} clubId={clubId} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="예정된 이벤트가 없습니다."
              description="곧 시작할 데일리 매치가 없으면 이 영역이 비어 있습니다."
              actionLabel={
                access.capabilities.canCreateEvent ? "새 이벤트 만들기" : undefined
              }
              onAction={
                access.capabilities.canCreateEvent
                  ? () => router.push(`/clubs/${clubId}/club-record/new`)
                  : undefined
              }
            />
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-5" />
              <h2 className="text-lg font-semibold">월간 공개 카드</h2>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/clubs/${clubId}/club-record/monthly`}>
                전체 보기
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
          {monthlyCard.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20 text-left text-muted-foreground">
                        <th className="px-4 py-3 font-medium">이름</th>
                        <th className="px-4 py-3 text-center font-medium">승</th>
                        <th className="px-4 py-3 text-center font-medium">패</th>
                        <th className="px-4 py-3 text-center font-medium">무</th>
                        <th className="px-4 py-3 text-center font-medium">승률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyCard.map((entry) => (
                        <tr key={entry.clubMemberId} className="border-b last:border-b-0">
                          <td className="px-4 py-3 font-medium">{entry.nickname}</td>
                          <td className="px-4 py-3 text-center">{entry.wins}</td>
                          <td className="px-4 py-3 text-center">{entry.losses}</td>
                          <td className="px-4 py-3 text-center">{entry.draws}</td>
                          <td className="px-4 py-3 text-center">
                            {Math.round(entry.winRate)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={Trophy}
              title="월간 카드 데이터가 없습니다."
              description="확정된 경기 결과가 쌓이면 여기에서 월간 승패를 볼 수 있습니다."
            />
          )}
        </section>
      </div>
    </div>
  );
}
