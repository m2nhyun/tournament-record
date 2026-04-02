"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cancelMatchScheduleRequest,
  joinMatchSchedule,
  leaveMatchSchedule,
  listUpcomingMatchSchedules,
  requestMatchSchedule,
} from "@/features/schedules/services/schedules";
import type { MatchScheduleSummary } from "@/features/schedules/types/schedule";

type StatusState = {
  type: "info" | "success" | "error";
  message: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function useClubSchedules(clubId: string) {
  const [schedules, setSchedules] = useState<MatchScheduleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyScheduleId, setBusyScheduleId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextSchedules = await listUpcomingMatchSchedules(clubId);
      setSchedules(nextSchedules);
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const join = useCallback(
    async (scheduleId: string) => {
      setBusyScheduleId(scheduleId);
      setStatus(null);
      try {
        await joinMatchSchedule(scheduleId);
        await refresh();
        setStatus({ type: "success", message: "일정에 참가했습니다." });
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setBusyScheduleId(null);
      }
    },
    [refresh],
  );

  const leave = useCallback(
    async (scheduleId: string) => {
      setBusyScheduleId(scheduleId);
      setStatus(null);
      try {
        await leaveMatchSchedule(scheduleId);
        await refresh();
        setStatus({ type: "success", message: "일정 참가를 취소했습니다." });
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setBusyScheduleId(null);
      }
    },
    [refresh],
  );

  const request = useCallback(
    async (scheduleId: string) => {
      setBusyScheduleId(scheduleId);
      setStatus(null);
      try {
        await requestMatchSchedule(scheduleId);
        await refresh();
        setStatus({ type: "success", message: "참가 신청을 보냈습니다." });
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setBusyScheduleId(null);
      }
    },
    [refresh],
  );

  const cancelRequest = useCallback(
    async (scheduleId: string) => {
      setBusyScheduleId(scheduleId);
      setStatus(null);
      try {
        await cancelMatchScheduleRequest(scheduleId);
        await refresh();
        setStatus({ type: "success", message: "참가 신청을 취소했습니다." });
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setBusyScheduleId(null);
      }
    },
    [refresh],
  );

  return {
    schedules,
    loading,
    busyScheduleId,
    status,
    refresh,
    join,
    leave,
    request,
    cancelRequest,
  };
}
