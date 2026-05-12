"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getClubRecordEventWorkspace } from "@/features/club-record/services/workspace";
import type { ClubRecordEventWorkspace } from "@/features/club-record/types/workspace";

export function useClubRecordEventWorkspace(eventId: string) {
  const [workspace, setWorkspace] = useState<ClubRecordEventWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordEventWorkspace(eventId);
      setWorkspace(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { workspace, loading, error, refresh };
}
