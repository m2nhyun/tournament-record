"use client";

import { useCallback, useState } from "react";

import { submitMatchResult } from "@/features/club-record/services/results";
import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import type {
  ClubRecordMatchResult,
  ClubRecordResultInput,
} from "@/features/club-record/types/match";

export function useClubRecordResultEntry(matchId: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClubRecordMatchResult | null>(null);

  const submit = useCallback(
    async (input: ClubRecordResultInput) => {
      setSubmitting(true);
      setError(null);
      try {
        const next = await submitMatchResult(matchId, input);
        setResult(next);
        return next;
      } catch (err) {
        const message = toClubRecordErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [matchId],
  );

  return { result, submitting, error, submit };
}
