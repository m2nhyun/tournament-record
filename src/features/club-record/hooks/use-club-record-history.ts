"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import {
  getClubRecordMemberHistory,
  getMyClubRecordHistory,
} from "@/features/club-record/services/history";
import type { ClubRecordHistoryEntry } from "@/features/club-record/types/history";

export function useClubRecordHistory(clubId: string) {
  const [entries, setEntries] = useState<ClubRecordHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyClubRecordHistory(clubId);
      setEntries(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}

export function useClubRecordMemberHistory(
  clubId: string,
  targetClubMemberId: string,
) {
  const [entries, setEntries] = useState<ClubRecordHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordMemberHistory(clubId, targetClubMemberId);
      setEntries(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId, targetClubMemberId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
