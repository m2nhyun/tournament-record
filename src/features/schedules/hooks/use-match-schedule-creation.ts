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
  const [time, setTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [courtFee, setCourtFee] = useState("0");
  const [ballFee, setBallFee] = useState("0");
  const [capacity, setCapacity] = useState("4");
  const [notes, setNotes] = useState("");

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
  const participantCount = 1;
  const remainingSlots = Math.max(0, Number(capacity || "0") - participantCount);
  const totalFee = Number(courtFee || "0") + Number(ballFee || "0");
  const estimatedFeePerPerson =
    Number.isFinite(totalFee) && Number(capacity) > 0
      ? Math.ceil(totalFee / Number(capacity))
      : 0;

  useEffect(() => {
    if (status?.type === "error") {
      setStatus(null);
    }
  }, [ballFee, capacity, courtFee, date, format, location, notes, status, time]);

  const submit = useCallback(async () => {
    if (submitting) return;

    const normalizedLocation = location.trim();
    const normalizedCapacity = Number(capacity);
    const normalizedCourtFee = Number(courtFee || "0");
    const normalizedBallFee = Number(ballFee || "0");

    if (!date || !time) {
      setStatus({ type: "error", message: "날짜와 시간을 모두 선택해주세요." });
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
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
        location: normalizedLocation,
        courtFee: normalizedCourtFee,
        ballFee: normalizedBallFee,
        capacity: normalizedCapacity,
        notes: notes.trim(),
      };
      const scheduleId = await createMatchSchedule(clubId, payload);
      setCreatedScheduleId(scheduleId);
      setStatus({
        type: "success",
        message: "일정을 만들었고, 개설자로 자동 참가되었습니다.",
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
    location,
    notes,
    participantCount,
    submitting,
    time,
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
    time,
    setTime,
    location,
    setLocation,
    courtFee,
    setCourtFee,
    ballFee,
    setBallFee,
    capacity,
    setCapacity,
    notes,
    setNotes,
    participantCount,
    remainingSlots,
    estimatedFeePerPerson,
    submit,
  };
}
