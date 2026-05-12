"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, PlusCircle } from "lucide-react";

import { AppBar } from "@/components/layout/app-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClubRecordAccess } from "@/features/club-record/hooks/use-club-record-access";
import { createClubRecordEvent } from "@/features/club-record/services/events";

type ClubRecordEventFormViewProps = {
  clubId: string;
};

const halfHourOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatPreview(date: string, startTime: string, endTime: string) {
  if (!date || !startTime || !endTime) {
    return "날짜와 시작/종료 시간을 입력하면 미리보기가 표시됩니다.";
  }

  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "시간 형식을 다시 확인해주세요.";
  }
  if (end.getTime() <= start.getTime()) {
    return "종료 시간은 시작 시간보다 늦어야 합니다.";
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const slotCount = durationMinutes / 30;
  return `${date} ${startTime} - ${endTime} · 30분 슬롯 ${slotCount}개`;
}

export function ClubRecordEventFormView({
  clubId,
}: ClubRecordEventFormViewProps) {
  const router = useRouter();
  const { access, loading, error } = useClubRecordAccess(clubId);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(getTodayIsoDate());
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");
  const [courtCount, setCourtCount] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);

  const preview = useMemo(
    () => formatPreview(eventDate, startTime, endTime),
    [endTime, eventDate, startTime],
  );

  if (loading) {
    return <LoadingSpinner title="로딩 중" message="이벤트 생성 권한을 확인하는 중..." />;
  }

  if (error || !access) {
    return (
      <div className="space-y-4">
        <AppBar title="새 이벤트" showBack />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox type="error" message={error ?? "접근 권한을 확인하지 못했습니다."} />
        </div>
      </div>
    );
  }

  if (!access.capabilities.canCreateEvent) {
    return (
      <div className="space-y-4">
        <AppBar title="새 이벤트" showBack />
        <div className="px-4 pt-4">
          <EmptyState
            icon={PlusCircle}
            title="운영진 이상만 이벤트를 만들 수 있습니다."
            description="데일리 매치 생성은 운영진과 관리자만 사용할 수 있습니다."
          />
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const normalizedCourtCount = Number(courtCount);
      if (!Number.isInteger(normalizedCourtCount) || normalizedCourtCount < 1) {
        throw new Error("코트 수는 1 이상이어야 합니다.");
      }

      const startsAt = toIsoDateTime(eventDate, startTime);
      const endsAt = toIsoDateTime(eventDate, endTime);

      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        throw new Error("종료 시간은 시작 시간보다 늦어야 합니다.");
      }

      const nextEventId = await createClubRecordEvent(clubId, {
        title,
        eventDate,
        startsAt,
        endsAt,
        courtCount: normalizedCourtCount,
      });

      router.push(`/clubs/${clubId}/club-record/${nextEventId}`);
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "이벤트 생성 실패",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AppBar title="새 데일리 매치" showBack />
      <div className="space-y-4 px-4">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">빠른 생성</p>
            <p className="text-sm text-muted-foreground">
              날짜, 시작/종료 시간, 코트 수만 정하면 슬롯이 바로 생성됩니다.
            </p>
            <p className="text-xs text-muted-foreground">{preview}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>이벤트 기본 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="club-record-title">이벤트 이름</Label>
                <Input
                  id="club-record-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="비워두면 데일리 매치로 표시됩니다."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="club-record-date">날짜</Label>
                  <Input
                    id="club-record-date"
                    type="date"
                    value={eventDate}
                    min={getTodayIsoDate()}
                    onChange={(event) => setEventDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="club-record-court-count">코트 수</Label>
                  <Input
                    id="club-record-court-count"
                    type="number"
                    min={1}
                    step={1}
                    value={courtCount}
                    onChange={(event) => setCourtCount(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="club-record-start-time">시작 시간</Label>
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3">
                    <Clock3 className="size-4 text-muted-foreground" />
                    <select
                      id="club-record-start-time"
                      className="h-11 w-full bg-transparent text-sm outline-none"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                    >
                      {halfHourOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="club-record-end-time">종료 시간</Label>
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <select
                      id="club-record-end-time"
                      className="h-11 w-full bg-transparent text-sm outline-none"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    >
                      {halfHourOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={submitting}>
                  <PlusCircle className="size-4" />
                  {submitting ? "생성 중..." : "이벤트 생성"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/clubs/${clubId}/club-record`)}
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
