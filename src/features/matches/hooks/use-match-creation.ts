"use client";

import { useCallback, useEffect, useState } from "react";

import { listClubMembers } from "@/features/clubs/services/clubs";
import {
  createMatch,
  deleteMatch,
  getMatchDetail,
  updateMatch,
} from "@/features/matches/services/matches";
import type { ClubMember } from "@/features/clubs/types/club";
import type {
  MatchType,
  MatchStatus,
  PlayerAssignment,
  SetScore,
} from "@/features/matches/types/match";
import { canRecordMatch as canRecordMatchByRole } from "@/features/matches/utils/match-permissions";

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

export function useMatchCreation(clubId: string, matchId?: string) {
  const [step, setStep] = useState<CreationStep>("type");
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [deletedMatch, setDeletedMatch] = useState(false);
  const [loadedMatchStatus, setLoadedMatchStatus] = useState<MatchStatus | null>(null);

  // Step 1: match type
  const [matchType, setMatchType] = useState<MatchType>("singles");
  const [playedAt, setPlayedAt] = useState(todayString());

  // Step 2: player selection
  const [side1Ids, setSide1Ids] = useState<string[]>([]);
  const [side2Ids, setSide2Ids] = useState<string[]>([]);

  // Step 3: scores
  const [gamesToWin, setGamesToWin] = useState<4 | 6>(6);
  const [setScores, setSetScores] = useState<SetScore[]>([
    {
      set: 1,
      side1: 0,
      side2: 0,
      gamesToWin: 6,
    },
  ]);
  const isEditMode = Boolean(matchId);

  useEffect(() => {
    let cancelled = false;
    setLoadingMembers(true);
    Promise.all([
      listClubMembers(clubId),
      matchId ? getMatchDetail(matchId) : Promise.resolve(null),
    ])
      .then(([memberData, matchData]) => {
        if (cancelled) return;

        setMembers(memberData);

        if (!matchData) return;

        setLoadedMatchStatus(matchData.status);
        setMatchType(matchData.matchType);
        setPlayedAt(matchData.playedAt.slice(0, 10));
        setSide1Ids(
          matchData.players
            .filter((player) => player.side === 1)
            .sort((a, b) => a.position - b.position)
            .map((player) => player.clubMemberId),
        );
        setSide2Ids(
          matchData.players
            .filter((player) => player.side === 2)
            .sort((a, b) => a.position - b.position)
            .map((player) => player.clubMemberId),
        );

        const initialScores: SetScore[] =
          matchData.result?.setScores.length
            ? matchData.result.setScores.map((score, index) => ({
                ...score,
                set: index + 1,
                gamesToWin:
                  score.gamesToWin ??
                  matchData.result?.setScores[0]?.gamesToWin ??
                  6,
              }))
            : [
                {
                  set: 1,
                  side1: 0,
                  side2: 0,
                  gamesToWin: 6,
                },
              ];

        setGamesToWin(initialScores[0]?.gamesToWin === 4 ? 4 : 6);
        setSetScores(initialScores);
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
  }, [clubId, matchId]);

  useEffect(() => {
    if (members.length < 4 && matchType === "doubles") {
      setMatchType("singles");
      setStatus({
        type: "info",
        message: "복식은 최소 4명이 필요해 단식으로 전환했습니다.",
      });
    }
  }, [members.length, matchType]);

  const requiredPerSide = matchType === "singles" ? 1 : 2;
  const myMembership = members.find((member) => member.isMe) ?? null;
  const canRecordMatch = canRecordMatchByRole(myMembership);
  const canCreateAnyMatch = members.length >= 2;
  const canUseDoubles = members.length >= 4;
  const selectedTypeMemberRequirementMet =
    matchType === "singles" ? members.length >= 2 : members.length >= 4;

  const canGoToPlayers =
    matchType !== null && playedAt !== "" && selectedTypeMemberRequirementMet;
  const canGoToScore =
    side1Ids.length === requiredPerSide && side2Ids.length === requiredPerSide;
  const canSubmit = setScores.length > 0;

  const goToPlayers = useCallback(() => {
    if (!canCreateAnyMatch) {
      setStatus({
        type: "error",
        message: "경기를 기록하려면 클럽 멤버가 최소 2명 필요합니다.",
      });
      return;
    }

    if (!selectedTypeMemberRequirementMet) {
      setStatus({
        type: "error",
        message:
          matchType === "doubles"
            ? "복식은 최소 4명이 필요합니다."
            : "단식은 최소 2명이 필요합니다.",
      });
      return;
    }

    if (!canGoToPlayers) return;
    setStatus(null);
    setStep("players");
  }, [
    canCreateAnyMatch,
    selectedTypeMemberRequirementMet,
    matchType,
    canGoToPlayers,
  ]);

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
      {
        set: prev.length + 1,
        side1: 0,
        side2: 0,
        gamesToWin,
      },
    ]);
  }, [gamesToWin]);

  const updateGamesToWin = useCallback((value: 4 | 6) => {
    setGamesToWin(value);
    setSetScores((prev) =>
      prev.map((score) => ({
        ...score,
        gamesToWin: value,
      })),
    );
  }, []);

  const removeLastSet = useCallback(() => {
    setSetScores((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const removeSet = useCallback((setIndex: number) => {
    setSetScores((prev) =>
      prev
        .filter((_, index) => index !== setIndex)
        .map((score, index) => ({ ...score, set: index + 1 })),
    );
  }, []);

  const updateSetScore = useCallback(
    (
      setIndex: number,
      side: "side1" | "side2" | "side1Point" | "side2Point",
      value: number | "0" | "15" | "30" | "40" | "AD" | "",
    ) => {
      setSetScores((prev) =>
        prev.map((s, i) => {
          if (i !== setIndex) return s;
          if ((side === "side1Point" || side === "side2Point") && value === "") {
            const next = { ...s };
            delete next[side];
            return next;
          }
          return { ...s, [side]: value };
        }),
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

      const savedMatchId =
        isEditMode && matchId
          ? await updateMatch(matchId, {
              matchType,
              playedAt: new Date(playedAt).toISOString(),
              players,
              setScores,
            })
          : await createMatch(clubId, {
              matchType,
              playedAt: new Date(playedAt).toISOString(),
              players,
              setScores,
            });

      setCreatedMatchId(savedMatchId);
      setStatus({
        type: "success",
        message: isEditMode
          ? "경기 기록을 수정했고, 다시 상대 확인 대기 상태로 전환했습니다."
          : "경기를 저장했고, 상대 확인을 요청했습니다.",
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
    isEditMode,
    matchId,
    matchType,
    playedAt,
    setScores,
  ]);

  const deleteCurrentMatch = useCallback(async () => {
    if (!isEditMode || !matchId || deleting) return;

    setDeleting(true);
    setStatus(null);

    try {
      await deleteMatch(matchId);
      setDeletedMatch(true);
      setStatus({
        type: "success",
        message: "경기가 삭제되었습니다.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setDeleting(false);
    }
  }, [deleting, isEditMode, matchId]);

  return {
    step,
    members,
    loadingMembers,
    submitting,
    deleting,
    status,
    createdMatchId,
    deletedMatch,
    loadedMatchStatus,
    isEditMode,

    matchType,
    setMatchType,
    playedAt,
    setPlayedAt,

    side1Ids,
    side2Ids,
    togglePlayer,
    requiredPerSide,

    setScores,
    gamesToWin,
    setGamesToWin: updateGamesToWin,
    addSet,
    removeLastSet,
    removeSet,
    updateSetScore,

    canGoToPlayers,
    canCreateAnyMatch,
    canRecordMatch,
    canUseDoubles,
    canGoToScore,
    canSubmit,
    goToPlayers,
    goToScore,
    goBack,
    submit,
    deleteCurrentMatch,
  };
}
