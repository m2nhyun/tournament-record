"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getClubRecordEvent } from "@/features/club-record/services/events";
import type { ClubRecordEvent } from "@/features/club-record/types/event";

export function useClubRecordEventDetail(eventId: string) {
  const [event, setEvent] = useState<ClubRecordEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordEvent(eventId);
      setEvent(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { event, loading, error, refresh };
}
