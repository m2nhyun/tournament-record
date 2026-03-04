"use client";

import { useCallback, useEffect, useState } from "react";

import { getMatchDetail } from "@/features/matches/services/matches";
import type { MatchDetail } from "@/features/matches/types/match";

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function useMatchDetail(matchId: string) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMatchDetail(matchId);
      setMatch(data);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { match, loading, error, refresh };
}
