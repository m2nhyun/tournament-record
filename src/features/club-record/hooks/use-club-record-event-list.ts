"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getClubRecordEvents } from "@/features/club-record/services/events";
import type { ClubRecordEvent } from "@/features/club-record/types/event";

export function useClubRecordEventList(clubId: string) {
  const [events, setEvents] = useState<ClubRecordEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordEvents(clubId);
      setEvents(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}
