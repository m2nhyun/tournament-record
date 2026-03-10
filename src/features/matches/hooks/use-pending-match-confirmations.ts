"use client";

import { useCallback, useEffect, useState } from "react";

import { listPendingMatchConfirmations } from "@/features/matches/services/matches";
import type { PendingMatchConfirmationSummary } from "@/features/matches/types/match";

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function usePendingMatchConfirmations(clubId: string) {
  const [items, setItems] = useState<PendingMatchConfirmationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingMatchConfirmations(clubId);
      setItems(data);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
