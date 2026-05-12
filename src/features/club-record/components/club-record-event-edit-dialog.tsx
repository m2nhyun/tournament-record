"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/common/modal";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClubRecordEvent } from "@/features/club-record/services/events";
import type { ClubRecordEvent } from "@/features/club-record/types/event";

type ClubRecordEventEditDialogProps = {
  event: ClubRecordEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
};

const halfHourOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function toTimeInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "19:00";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toMaybeDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isSameTimestamp(left: string, right: string) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function formatPreview(date: string, startTime: string, endTime: string) {
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "시간 형식을 다시 확인해주세요.";
  }
  if (end.getTime() <= start.getTime()) {
    return "종료 시간은 시작 시간보다 늦어야 합니다.";
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${date} ${startTime} - ${endTime} · 30분 슬롯 ${durationMinutes / 30}개`;
}

export function ClubRecordEventEditDialog({
  event,
  open,
  onOpenChange,
  onSaved,
}: ClubRecordEventEditDialogProps) {
  const [title, setTitle] = useState(event.title ?? "");
  const [eventDate, setEventDate] = useState(event.eventDate.slice(0, 10));
  const [startTime, setStartTime] = useState(toTimeInputValue(event.startsAt));
  const [endTime, setEndTime] = useState(toTimeInputValue(event.endsAt));
  const [courtCount, setCourtCount] = useState(String(event.courtCount));
  const [acknowledgeReset, setAcknowledgeReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<null | {
    type: "success" | "error" | "info";
    message: string;
  }>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(event.title ?? "");
    setEventDate(event.eventDate.slice(0, 10));
    setStartTime(toTimeInputValue(event.startsAt));
    setEndTime(toTimeInputValue(event.endsAt));
    setCourtCount(String(event.courtCount));
    setAcknowledgeReset(false);
    setStatus(null);
  }, [event, open]);

  const nextStartDate = useMemo(
    () => toMaybeDateTime(eventDate, startTime),
    [eventDate, startTime],
  );
  const nextEndDate = useMemo(
    () => toMaybeDateTime(eventDate, endTime),
    [endTime, eventDate],
  );
  const normalizedCourtCount = Number(courtCount);
  const scheduleChanged =
    eventDate !== event.eventDate.slice(0, 10) ||
    (nextStartDate ? !isSameTimestamp(nextStartDate.toISOString(), event.startsAt) : true) ||
    (nextEndDate ? !isSameTimestamp(nextEndDate.toISOString(), event.endsAt) : true) ||
    normalizedCourtCount !== event.courtCount;
  const preview = useMemo(
    () => formatPreview(eventDate, startTime, endTime),
    [endTime, eventDate, startTime],
  );

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setStatus(null);

    if (!Number.isInteger(normalizedCourtCount) || normalizedCourtCount < 1) {
      setStatus({ type: "error", message: "코트 수는 1 이상이어야 합니다." });
      return;
    }
    if (!nextStartDate || !nextEndDate) {
      setStatus({ type: "error", message: "날짜와 시간을 다시 확인해주세요." });
      return;
    }
    const startsAt = nextStartDate.toISOString();
    const endsAt = nextEndDate.toISOString();
    if (nextEndDate.getTime() <= nextStartDate.getTime()) {
      setStatus({ type: "error", message: "종료 시간은 시작 시간보다 늦어야 합니다." });
      return;
    }
    if (scheduleChanged && !acknowledgeReset) {
      setStatus({
        type: "error",
        message: "시간/코트 변경 시 기존 참가자와 편성이 초기화됩니다.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await updateClubRecordEvent(event.id, {
        title,
        eventDate,
        startsAt,
        endsAt,
        courtCount: normalizedCourtCount,
      });
      await onSaved();
      setStatus({ type: "success", message: "이벤트 정보를 저장했습니다." });
      onOpenChange(false);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "이벤트 수정 실패",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="이벤트 수정">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <div className="space-y-1.5">
          <Label htmlFor="club-record-edit-title">이벤트 이름</Label>
          <Input
            id="club-record-edit-title"
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            placeholder="비워두면 데일리 매치로 표시됩니다."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-record-edit-date">날짜</Label>
          <Input
            id="club-record-edit-date"
            type="date"
            value={eventDate}
            onChange={(changeEvent) => setEventDate(changeEvent.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-record-edit-start-time">시작 시간</Label>
          <select
            id="club-record-edit-start-time"
            className="h-11 w-full rounded-xl border bg-muted/20 px-3 text-sm outline-none"
            value={startTime}
            onChange={(changeEvent) => setStartTime(changeEvent.target.value)}
          >
            {halfHourOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-record-edit-end-time">종료 시간</Label>
          <select
            id="club-record-edit-end-time"
            className="h-11 w-full rounded-xl border bg-muted/20 px-3 text-sm outline-none"
            value={endTime}
            onChange={(changeEvent) => setEndTime(changeEvent.target.value)}
          >
            {halfHourOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-record-edit-court-count">코트 수</Label>
          <Input
            id="club-record-edit-court-count"
            type="number"
            min={1}
            step={1}
            value={courtCount}
            onChange={(changeEvent) => setCourtCount(changeEvent.target.value)}
          />
        </div>

        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
          {preview}
        </div>

        {scheduleChanged ? (
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acknowledgeReset}
              onChange={(changeEvent) =>
                setAcknowledgeReset(changeEvent.target.checked)
              }
            />
            <span>
              시간, 날짜, 코트 수 변경 시 기존 참가자와 편성이 초기화됩니다. 확정된
              경기가 있으면 저장이 차단됩니다.
            </span>
          </label>
        ) : null}

        <div className="grid gap-2 pt-1">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "저장 중..." : "저장"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
        </div>
      </form>
    </Modal>
  );
}
