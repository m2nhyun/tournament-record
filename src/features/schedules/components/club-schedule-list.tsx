"use client";

import Link from "next/link";
import { CalendarClock, MapPin, Users } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubSchedules } from "@/features/schedules/hooks/use-club-schedules";
import {
  formatScheduleDateTimeRange,
  formatWon,
  scheduleFormatLabels,
  scheduleJoinPolicyLabels,
  scheduleStatusLabels,
} from "@/features/schedules/utils/schedule-format";
import type { ClubRole } from "@/features/clubs/types/club";

type ClubScheduleListProps = {
  clubId: string;
  myRole: ClubRole;
};

export function ClubScheduleList({ clubId, myRole }: ClubScheduleListProps) {
  const {
    schedules,
    loading,
    busyScheduleId,
    status,
    join,
    leave,
    request,
    cancelRequest,
  } =
    useClubSchedules(clubId);

  const canCreateSchedule = myRole !== "guest";

  if (loading) {
    return (
      <LoadingSpinner
        title="일정 불러오는 중"
        message="다가오는 일정과 참가 현황을 정리하는 중..."
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="size-5" />
            다가오는 일정
          </h2>
          <p className="text-xs text-muted-foreground">
            새로 만든 일정은 생성 직후 여기 맨 위 카드와 상세 화면에서 바로 확인할 수
            있습니다.
          </p>
        </div>
        {canCreateSchedule ? (
          <Button
            size="sm"
            className="bg-[var(--brand)] text-white hover:opacity-90"
            asChild
          >
            <Link href={`/clubs/${clubId}/matches/new?mode=schedule`}>일정 잡기</Link>
          </Button>
        ) : null}
      </div>

      {status ? <StatusBox type={status.type} message={status.message} /> : null}

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="예정된 일정이 없습니다."
          description="다음 정모나 복식 일정을 먼저 열어두면 참가 인원과 비용을 한 번에 모을 수 있습니다."
        />
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => {
            const isBusy = busyScheduleId === schedule.id;
            const canJoinInstant =
              schedule.joinPolicy === "instant" &&
              !schedule.isParticipant &&
              schedule.status !== "cancelled" &&
              schedule.remainingSlots > 0;
            const canLeave =
              schedule.isParticipant && !schedule.isHost && schedule.status !== "cancelled";
            const canRequest =
              schedule.joinPolicy === "approval_required" &&
              !schedule.isParticipant &&
              schedule.myRequestStatus !== "pending" &&
              schedule.status !== "cancelled" &&
              schedule.remainingSlots > 0;
            const canCancelRequest =
              schedule.joinPolicy === "approval_required" &&
              schedule.myRequestStatus === "pending";

            return (
              <Card key={schedule.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand">{scheduleFormatLabels[schedule.format]}</Badge>
                    <Badge>{scheduleStatusLabels[schedule.status]}</Badge>
                    <Badge>{scheduleJoinPolicyLabels[schedule.joinPolicy]}</Badge>
                    {!schedule.hostParticipates ? (
                      <Badge variant="warning">개설자 미포함</Badge>
                    ) : null}
                    {schedule.requestCount > 0 ? (
                      <Badge variant="warning">대기 신청 {schedule.requestCount}건</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      개설 {schedule.hostNickname}
                    </span>
                  </div>
                  <CardTitle className="text-base">
                    {formatScheduleDateTimeRange(
                      schedule.scheduledAt,
                      schedule.endsAt,
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <MapPin className="size-4" />
                      {schedule.location}
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <Users className="size-4" />
                      {schedule.participantCount}/{schedule.capacity}명
                      <span className="text-foreground">
                        남은 자리 {schedule.remainingSlots}명
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>코트비 {formatWon(schedule.courtFee)}</span>
                      <span>캔볼 {formatWon(schedule.ballFee)}</span>
                    </div>
                    {schedule.notes ? (
                      <p className="mt-2 text-muted-foreground">{schedule.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {schedule.participants.length > 0 ? (
                      schedule.participants.map((participant) => (
                        <Badge key={participant.clubMemberId}>
                          {participant.nickname}
                          {participant.isHost ? " · 개설자" : ""}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        아직 참가자가 없습니다.
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href={`/clubs/${clubId}/schedules/${schedule.id}`}>
                        상세 보기
                      </Link>
                    </Button>
                    {canJoinInstant ? (
                      <Button
                        className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
                        disabled={isBusy}
                        onClick={() => void join(schedule.id)}
                      >
                        참가하기
                      </Button>
                    ) : null}
                    {canRequest ? (
                      <Button
                        className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
                        disabled={isBusy}
                        onClick={() => void request(schedule.id)}
                      >
                        참가 신청
                      </Button>
                    ) : null}
                    {canCancelRequest ? (
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={isBusy}
                        onClick={() => void cancelRequest(schedule.id)}
                      >
                        신청 취소
                      </Button>
                    ) : null}
                    {canLeave ? (
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={isBusy}
                        onClick={() => void leave(schedule.id)}
                      >
                        참가 취소
                      </Button>
                    ) : null}
                    {schedule.isHost ? (
                      <div className="flex-1 rounded-md border bg-muted/20 px-3 py-2 text-center text-sm text-muted-foreground">
                        개설자로 참가 중
                      </div>
                    ) : null}
                    {!canJoinInstant &&
                    !canRequest &&
                    !canCancelRequest &&
                    !canLeave &&
                    !schedule.isHost ? (
                      <div className="flex-1 rounded-md border bg-muted/20 px-3 py-2 text-center text-sm text-muted-foreground">
                        {schedule.status === "cancelled"
                          ? "취소된 일정"
                          : schedule.myRequestStatus === "pending"
                            ? "신청 응답 대기 중"
                            : "참가 가능 상태 아님"}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
