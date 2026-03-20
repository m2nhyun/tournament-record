"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { listClubMembers } from "@/features/clubs/services/clubs";
import type { ClubMember } from "@/features/clubs/types/club";
import { canRecordMatch as canRecordMatchByRole } from "@/features/matches/utils/match-permissions";
import { createMatchSchedule } from "@/features/schedules/services/schedules";
import type {
  MatchScheduleCreationData,
  MatchScheduleFormat,
} from "@/features/schedules/types/schedule";

type StatusState = {
  type: "info" | "success" | "error";
  message: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

function futureDateString() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addMinutes(value: string, amount: number) {
  return minutesToTime(timeToMinutes(value) + amount);
}

function sortTimes(values: string[]) {
  return [...values].sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
}

function buildSlotRange(start: string, end: string) {
  const slots: string[] = [];
  let current = timeToMinutes(start);
  const last = timeToMinutes(end);

  while (current <= last) {
    slots.push(minutesToTime(current));
    current += 60;
  }

  return slots;
}

function toggleTimeSlot(current: string[], slot: string) {
  const sorted = sortTimes(current);

  if (sorted.length === 0) return [slot];

  if (sorted.length === 1) {
    if (slot === sorted[0]) return [];
    if (Math.abs(timeToMinutes(slot) - timeToMinutes(sorted[0])) === 60) {
      return buildSlotRange(sortTimes([sorted[0], slot])[0], sortTimes([sorted[0], slot])[1]);
    }
    return [slot];
  }

  if (!sorted.includes(slot)) {
    const startMinutes = timeToMinutes(sorted[0]);
    const endMinutes = timeToMinutes(sorted[sorted.length - 1]);
    const slotMinutes = timeToMinutes(slot);

    if (slotMinutes === startMinutes - 60) {
      return [slot, ...sorted];
    }

    if (slotMinutes === endMinutes + 60) {
      return [...sorted, slot];
    }

    return [slot];
  }

  if (slot === sorted[0]) return sorted.slice(1);
  if (slot === sorted[sorted.length - 1]) return sorted.slice(0, -1);

  return buildSlotRange(sorted[0], addMinutes(slot, -60));
}

export const suggestedScheduleTimes = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

export function useMatchScheduleCreation(clubId: string) {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [createdScheduleId, setCreatedScheduleId] = useState<string | null>(null);

  const [format, setFormat] = useState<MatchScheduleFormat>("open_doubles");
  const [date, setDate] = useState(futureDateString());
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [courtFee, setCourtFee] = useState("0");
  const [ballFee, setBallFee] = useState("0");
  const [capacity, setCapacity] = useState("4");
  const [notes, setNotes] = useState("");
  const [includeCourtFee, setIncludeCourtFee] = useState(true);
  const [includeBallFee, setIncludeBallFee] = useState(true);
  const [includeHost, setIncludeHost] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingMembers(true);
    void listClubMembers(clubId)
      .then((memberData) => {
        if (cancelled) return;
        setMembers(memberData);
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus({ type: "error", message: toMessage(error) });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const myMembership = useMemo(
    () => members.find((member) => member.isMe) ?? null,
    [members],
  );
  const canCreateSchedule = canRecordMatchByRole(myMembership);
  const participantCount = includeHost ? 1 : 0;
  const normalizedCapacity = Number(capacity || "0");
  const remainingSlots = Math.max(0, normalizedCapacity - participantCount);
  const timeSlots = sortTimes(selectedTimeSlots);
  const startTime = timeSlots[0] ?? "";
  const endTime =
    timeSlots.length > 0 ? addMinutes(timeSlots[timeSlots.length - 1], 60) : "";
  const totalFee =
    (includeCourtFee ? Number(courtFee || "0") : 0) +
    (includeBallFee ? Number(ballFee || "0") : 0);
  const estimatedFeePerPerson =
    Number.isFinite(totalFee) && normalizedCapacity > 0
      ? Math.ceil(totalFee / normalizedCapacity)
      : 0;

  useEffect(() => {
    if (status?.type === "error") {
      setStatus(null);
    }
  }, [
    ballFee,
    capacity,
    courtFee,
    date,
    format,
    includeBallFee,
    includeCourtFee,
    includeHost,
    location,
    notes,
    selectedTimeSlots,
    status,
  ]);

  const submit = useCallback(async () => {
    if (submitting) return;

    const normalizedLocation = location.trim();
    const normalizedCapacity = Number(capacity);
    const normalizedCourtFee = includeCourtFee ? Number(courtFee || "0") : 0;
    const normalizedBallFee = includeBallFee ? Number(ballFee || "0") : 0;

    if (!date || timeSlots.length === 0) {
      setStatus({ type: "error", message: "날짜와 시간을 모두 선택해주세요." });
      return;
    }

    const scheduledAt = new Date(`${date}T${startTime}:00`);
    const endsAt = new Date(`${date}T${endTime}:00`);
    if (
      Number.isNaN(scheduledAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt.getTime() <= scheduledAt.getTime()
    ) {
      setStatus({
        type: "error",
        message: "선택한 날짜 또는 시간이 올바르지 않습니다. 다시 확인해주세요.",
      });
      return;
    }

    if (normalizedLocation.length < 2) {
      setStatus({ type: "error", message: "장소를 2자 이상 입력해주세요." });
      return;
    }

    if (!Number.isFinite(normalizedCapacity) || normalizedCapacity < 2) {
      setStatus({ type: "error", message: "모집 인원은 최소 2명 이상이어야 합니다." });
      return;
    }

    if (normalizedCapacity > 8) {
      setStatus({ type: "error", message: "모집 인원은 최대 8명까지 설정할 수 있습니다." });
      return;
    }

    if (normalizedCapacity < participantCount) {
      setStatus({
        type: "error",
        message: "개설자 본인을 포함할 수 있도록 모집 인원을 늘려주세요.",
      });
      return;
    }

    if (
      !Number.isFinite(normalizedCourtFee) ||
      !Number.isFinite(normalizedBallFee) ||
      normalizedCourtFee < 0 ||
      normalizedBallFee < 0
    ) {
      setStatus({ type: "error", message: "비용은 0원 이상의 숫자로 입력해주세요." });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const payload: MatchScheduleCreationData = {
        format,
        scheduledAt: scheduledAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: normalizedLocation,
        courtFee: normalizedCourtFee,
        ballFee: normalizedBallFee,
        capacity: normalizedCapacity,
        includeHost,
        notes: notes.trim(),
      };
      const scheduleId = await createMatchSchedule(clubId, payload);
      setCreatedScheduleId(scheduleId);
      setStatus({
        type: "success",
        message: includeHost
          ? "일정을 만들었고, 개설자로 자동 참가되었습니다."
          : "일정을 만들었습니다. 개설자는 참가 인원에서 제외된 상태로 시작합니다.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }, [
    ballFee,
    capacity,
    clubId,
    courtFee,
    date,
    format,
    includeBallFee,
    includeCourtFee,
    includeHost,
    location,
    notes,
    participantCount,
    startTime,
    submitting,
    timeSlots,
    endTime,
  ]);

  return {
    members,
    loadingMembers,
    submitting,
    status,
    createdScheduleId,
    canCreateSchedule,
    format,
    setFormat,
    date,
    setDate,
    selectedTimeSlots: timeSlots,
    setSelectedTimeSlots,
    toggleTimeSlot: (slot: string) =>
      setSelectedTimeSlots((current) => toggleTimeSlot(current, slot)),
    startTime,
    endTime,
    location,
    setLocation,
    courtFee,
    setCourtFee,
    ballFee,
    setBallFee,
    capacity,
    setCapacity,
    includeCourtFee,
    setIncludeCourtFee,
    includeBallFee,
    setIncludeBallFee,
    includeHost,
    setIncludeHost,
    notes,
    setNotes,
    participantCount,
    remainingSlots,
    estimatedFeePerPerson,
    submit,
  };
}
