"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getMonthlyPublicCard } from "@/features/club-record/services/history";
import type { ClubRecordMonthlyCardEntry } from "@/features/club-record/types/history";
import {
  formatMonthLabel,
  getMonthStartIsoDate,
  shiftMonthStartIsoDate,
} from "@/features/club-record/utils/date";

export function useClubRecordMonthlyCard(clubId: string) {
  const [monthStart, setMonthStart] = useState(() => getMonthStartIsoDate());
  const [entries, setEntries] = useState<ClubRecordMonthlyCardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (targetMonthStart = monthStart) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMonthlyPublicCard(clubId, targetMonthStart);
        setEntries(data);
      } catch (err) {
        setError(toClubRecordErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [clubId, monthStart],
  );

  useEffect(() => {
    void refresh(monthStart);
  }, [monthStart, refresh]);

  const goToPreviousMonth = useCallback(() => {
    setMonthStart((current) => shiftMonthStartIsoDate(current, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthStart((current) => shiftMonthStartIsoDate(current, 1));
  }, []);

  const currentMonthStart = getMonthStartIsoDate();
  const isCurrentMonth = monthStart === currentMonthStart;

  return {
    entries,
    loading,
    error,
    monthStart,
    monthLabel: formatMonthLabel(monthStart),
    isCurrentMonth,
    canGoNext: !isCurrentMonth,
    refresh,
    goToPreviousMonth,
    goToNextMonth,
  };
}
