"use client";

import { useCallback, useEffect, useState } from "react";

import { listClubMatches } from "@/features/matches/services/matches";
import type { MatchSummary } from "@/features/matches/types/match";

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function useMatchList(clubId: string) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClubMatches(clubId);
      setMatches(data);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { matches, loading, error, refresh };
}
