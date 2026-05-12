"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getClubRecordParticipants } from "@/features/club-record/services/participants";
import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";

export function useClubRecordParticipants(eventId: string) {
  const [participants, setParticipants] = useState<ClubRecordEventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordParticipants(eventId);
      setParticipants(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { participants, loading, error, refresh };
}
