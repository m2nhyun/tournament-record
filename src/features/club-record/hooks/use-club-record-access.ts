"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import { getClubRecordAccessContext } from "@/features/club-record/services/access";
import type { ClubRecordAccessContext } from "@/features/club-record/types/access";

export function useClubRecordAccess(clubId: string) {
  const [access, setAccess] = useState<ClubRecordAccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordAccessContext(clubId);
      setAccess(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { access, loading, error, refresh };
}
