"use client";

import { useCallback, useEffect, useState } from "react";

import { listClubMembers } from "@/features/clubs/services/clubs";
import { createMatch } from "@/features/matches/services/matches";
import type { ClubMember } from "@/features/clubs/types/club";
import type {
  MatchType,
  PlayerAssignment,
  SetScore,
} from "@/features/matches/types/match";

export type CreationStep = "type" | "players" | "score";

type StatusState = {
  type: "info" | "success" | "error";
  message: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function useMatchCreation(clubId: string) {
  const [step, setStep] = useState<CreationStep>("type");
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);

  // Step 1: match type
  const [matchType, setMatchType] = useState<MatchType>("singles");
  const [playedAt, setPlayedAt] = useState(todayString());

  // Step 2: player selection
  const [side1Ids, setSide1Ids] = useState<string[]>([]);
  const [side2Ids, setSide2Ids] = useState<string[]>([]);

  // Step 3: scores
  const [setScores, setSetScores] = useState<SetScore[]>([
    { set: 1, side1: 0, side2: 0 },
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMembers(true);
    listClubMembers(clubId)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch((err) => {
        if (!cancelled) setStatus({ type: "error", message: toMessage(err) });
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const requiredPerSide = matchType === "singles" ? 1 : 2;

  const canGoToPlayers = matchType !== null && playedAt !== "";
  const canGoToScore =
    side1Ids.length === requiredPerSide && side2Ids.length === requiredPerSide;
  const canSubmit =
    setScores.length > 0 &&
    setScores.every((s) => s.side1 >= 0 && s.side2 >= 0);

  const goToPlayers = useCallback(() => {
    if (!canGoToPlayers) return;
    setStatus(null);
    setStep("players");
  }, [canGoToPlayers]);

  const goToScore = useCallback(() => {
    if (!canGoToScore) return;
    setStatus(null);
    setStep("score");
  }, [canGoToScore]);

  const goBack = useCallback(() => {
    setStatus(null);
    if (step === "score") setStep("players");
    else if (step === "players") setStep("type");
  }, [step]);

  const togglePlayer = useCallback(
    (memberId: string, side: 1 | 2) => {
      const setter = side === 1 ? setSide1Ids : setSide2Ids;
      const otherSetter = side === 1 ? setSide2Ids : setSide1Ids;

      setter((prev) => {
        if (prev.includes(memberId)) {
          return prev.filter((id) => id !== memberId);
        }
        if (prev.length >= requiredPerSide) return prev;
        return [...prev, memberId];
      });

      // Remove from other side if selected
      otherSetter((prev) => prev.filter((id) => id !== memberId));
    },
    [requiredPerSide],
  );

  const addSet = useCallback(() => {
    setSetScores((prev) => [
      ...prev,
      { set: prev.length + 1, side1: 0, side2: 0 },
    ]);
  }, []);

  const removeLastSet = useCallback(() => {
    setSetScores((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const updateSetScore = useCallback(
    (setIndex: number, side: "side1" | "side2", value: number) => {
      setSetScores((prev) =>
        prev.map((s, i) => (i === setIndex ? { ...s, [side]: value } : s)),
      );
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setStatus(null);

    try {
      const players: PlayerAssignment[] = [
        ...side1Ids.map((id, i) => {
          const member = members.find((m) => m.id === id);
          return {
            clubMemberId: id,
            nickname: member?.nickname ?? "",
            side: 1 as const,
            position: (i + 1) as 1 | 2,
          };
        }),
        ...side2Ids.map((id, i) => {
          const member = members.find((m) => m.id === id);
          return {
            clubMemberId: id,
            nickname: member?.nickname ?? "",
            side: 2 as const,
            position: (i + 1) as 1 | 2,
          };
        }),
      ];

      const matchId = await createMatch(clubId, {
        matchType,
        playedAt: new Date(playedAt).toISOString(),
        players,
        setScores,
      });

      setCreatedMatchId(matchId);
      setStatus({
        type: "success",
        message: "경기가 성공적으로 기록되었습니다!",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    side1Ids,
    side2Ids,
    members,
    clubId,
    matchType,
    playedAt,
    setScores,
  ]);

  return {
    step,
    members,
    loadingMembers,
    submitting,
    status,
    createdMatchId,

    matchType,
    setMatchType,
    playedAt,
    setPlayedAt,

    side1Ids,
    side2Ids,
    togglePlayer,
    requiredPerSide,

    setScores,
    addSet,
    removeLastSet,
    updateSetScore,

    canGoToPlayers,
    canGoToScore,
    canSubmit,
    goToPlayers,
    goToScore,
    goBack,
    submit,
  };
}
