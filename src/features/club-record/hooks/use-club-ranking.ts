"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import {
  getClubRanking,
  moveRankingPosition,
  syncClubRecordMembers,
} from "@/features/club-record/services/ranking";
import type {
  ClubRecordMember,
  ClubRecordRankingMoveInput,
} from "@/features/club-record/types/member";

export function useClubRanking(clubId: string, enabled = true) {
  const [members, setMembers] = useState<ClubRecordMember[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getClubRanking(clubId);
      setMembers(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId, enabled]);

  const move = useCallback(
    async (input: ClubRecordRankingMoveInput) => {
      await moveRankingPosition(clubId, input);
      await refresh();
    },
    [clubId, refresh],
  );

  const syncMembers = useCallback(async () => {
    const insertedCount = await syncClubRecordMembers(clubId);
    await refresh();
    return insertedCount;
  }, [clubId, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { members, loading, error, refresh, move, syncMembers };
}
