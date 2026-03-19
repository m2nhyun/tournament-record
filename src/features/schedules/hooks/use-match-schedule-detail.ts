"use client";

import { useCallback, useEffect, useState } from "react";

import { getMatchScheduleDetail } from "@/features/schedules/services/schedules";
import type { MatchScheduleDetail } from "@/features/schedules/types/schedule";

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "일정 정보를 불러오는 중 오류가 발생했습니다.";
}

export function useMatchScheduleDetail(clubId: string, scheduleId: string) {
  const [schedule, setSchedule] = useState<MatchScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSchedule = await getMatchScheduleDetail(clubId, scheduleId);
      setSchedule(nextSchedule);
    } catch (loadError) {
      setError(toMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [clubId, scheduleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { schedule, loading, error, refresh };
}
