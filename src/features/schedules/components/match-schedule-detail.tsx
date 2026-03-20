"use client";

import Link from "next/link";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { useState } from "react";

import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { AppBar } from "@/components/layout/app-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMatchScheduleDetail } from "@/features/schedules/hooks/use-match-schedule-detail";
import {
  joinMatchSchedule,
  leaveMatchSchedule,
} from "@/features/schedules/services/schedules";
import {
  formatScheduleDateTimeRange,
  formatWon,
  scheduleFormatLabels,
  scheduleStatusLabels,
} from "@/features/schedules/utils/schedule-format";

type MatchScheduleDetailViewProps = {
  clubId: string;
  scheduleId: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "일정 처리 중 오류가 발생했습니다.";
}

export function MatchScheduleDetailView({
  clubId,
  scheduleId,
}: MatchScheduleDetailViewProps) {
  const { schedule, loading, error, refresh } = useMatchScheduleDetail(
    clubId,
    scheduleId,
  );
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState<"join" | "leave" | null>(null);

  async function handleAction(action: "join" | "leave") {
    setSubmitting(action);
    setStatus(null);

    try {
      if (action === "join") {
        await joinMatchSchedule(scheduleId);
        setStatus({ type: "success", message: "일정에 참가했습니다." });
      } else {
        await leaveMatchSchedule(scheduleId);
        setStatus({ type: "success", message: "일정 참가를 취소했습니다." });
      }
      await refresh();
    } catch (actionError) {
      setStatus({ type: "error", message: toMessage(actionError) });
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <LoadingSpinner
        title="일정 불러오는 중"
        message="참가 현황과 일정 정보를 정리하는 중..."
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <AppBar title="일정 상세" showBack />
        <div className="space-y-4 px-4">
          <StatusBox type="error" message={error} />
          <Button variant="outline" asChild>
            <Link href={`/clubs/${clubId}`}>클럽 홈으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  const canJoin =
    !schedule.isParticipant &&
    schedule.status !== "cancelled" &&
    schedule.remainingSlots > 0;
  const canLeave =
    schedule.isParticipant && !schedule.isHost && schedule.status !== "cancelled";

  return (
    <div className="space-y-4">
      <AppBar
        title="일정 상세"
        showBack
        onBack={() => {
          window.location.href = `/clubs/${clubId}`;
        }}
      />
      <div className="space-y-4 px-4">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{scheduleFormatLabels[schedule.format]}</Badge>
              <Badge>{scheduleStatusLabels[schedule.status]}</Badge>
              {!schedule.hostParticipates ? (
                <Badge variant="warning">개설자 미포함</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                개설 {schedule.hostNickname}
              </span>
            </div>
            <CardTitle className="text-lg">
              {formatScheduleDateTimeRange(
                schedule.scheduledAt,
                schedule.endsAt,
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="inline-flex items-center gap-2">
                <CalendarClock className="size-4" />
                1인 예상 비용 약 {formatWon(schedule.estimatedFeePerPerson)}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>코트비 {formatWon(schedule.courtFee)}</span>
                <span>캔볼 {formatWon(schedule.ballFee)}</span>
              </div>
              {schedule.notes ? (
                <p className="mt-2 text-muted-foreground">{schedule.notes}</p>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  메모가 없는 일정입니다.
                </p>
              )}
            </div>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                참가자
              </p>
              <div className="flex flex-wrap gap-2">
                {schedule.participants.length > 0 ? (
                  schedule.participants.map((participant) => (
                    <Badge key={participant.clubMemberId}>
                      {participant.nickname}
                      {participant.isHost ? " · 개설자" : ""}
                      {participant.isMe ? " · 나" : ""}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    아직 참가자가 없습니다.
                  </span>
                )}
              </div>
            </section>

            <div className="flex flex-col gap-2 sm:flex-row">
              {canJoin ? (
                <Button
                  className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
                  disabled={submitting !== null}
                  onClick={() => void handleAction("join")}
                >
                  참가하기
                </Button>
              ) : null}
              {canLeave ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={submitting !== null}
                  onClick={() => void handleAction("leave")}
                >
                  참가 취소
                </Button>
              ) : null}
              {schedule.linkedMatchId ? (
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/clubs/${clubId}/matches/${schedule.linkedMatchId}`}>
                    연결된 경기 보기
                  </Link>
                </Button>
              ) : null}
            </div>

            {schedule.isHost ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                {schedule.hostParticipates
                  ? "개설자는 현재 참가 상태입니다."
                  : "개설자는 현재 참가 인원에서 제외된 운영자 상태입니다."}{" "}
                다음 단계에서는 이 화면에 일정 취소, 마감, 실제 경기 연결 같은
                운영 액션을 붙일 수 있습니다.
              </div>
            ) : null}
            {!canJoin && !canLeave && !schedule.isHost ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                {schedule.status === "cancelled"
                  ? "취소된 일정입니다."
                  : schedule.remainingSlots === 0
                    ? "정원이 모두 찼습니다."
                    : "현재 추가로 할 수 있는 액션이 없습니다."}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
