"use client";

import { useCallback, useEffect, useState } from "react";

import { getClubLeaderboard } from "@/features/leaderboard/services/leaderboard";
import type { LeaderboardEntry } from "@/features/leaderboard/types/leaderboard";

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function useLeaderboard(clubId: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubLeaderboard(clubId);
      setEntries(data);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
