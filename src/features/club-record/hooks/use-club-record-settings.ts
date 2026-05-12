"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getClubRecordSettings,
  updateClubRecordSettings,
} from "@/features/club-record/services/settings";
import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import type {
  ClubRecordSettings,
  ClubRecordSettingsUpdateInput,
} from "@/features/club-record/types/settings";

export function useClubRecordSettings(clubId: string) {
  const [settings, setSettings] = useState<ClubRecordSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClubRecordSettings(clubId);
      setSettings(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  const save = useCallback(
    async (input: ClubRecordSettingsUpdateInput) => {
      const next = await updateClubRecordSettings(clubId, input);
      setSettings(next);
      return next;
    },
    [clubId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, loading, error, refresh, save };
}
