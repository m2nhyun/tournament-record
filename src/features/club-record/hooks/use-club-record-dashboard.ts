"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getClubRecordDashboardData } from "@/features/club-record/services/dashboard";
import type { ClubRecordDashboardData } from "@/features/club-record/types/dashboard";

export function useClubRecordDashboard(clubId: string) {
  const [dashboard, setDashboard] = useState<ClubRecordDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordDashboardData(clubId);
      setDashboard(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
