"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getEventAssignmentBoard,
  runAutoAssignment,
} from "@/features/club-record/services/assignment";
import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import type {
  ClubRecordAssignmentBoard,
  ClubRecordEventSlotOverview,
} from "@/features/club-record/types/slot";

export function useClubRecordAssignment(eventId: string) {
  const [slots, setSlots] = useState<ClubRecordEventSlotOverview[]>([]);
  const [board, setBoard] = useState<ClubRecordAssignmentBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEventAssignmentBoard(eventId);
      setBoard(data);
      setSlots(data.slots);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const assign = useCallback(async () => {
    await runAutoAssignment(eventId);
    await refresh();
  }, [eventId, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { slots, board, loading, error, refresh, assign };
}
