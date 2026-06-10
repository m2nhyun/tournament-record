"use client";

import { type FormEvent, memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, Minus, MoreVertical, Pencil, Plus, Save, Trash2, UsersRound } from "lucide-react";

import { Modal } from "@/components/common/modal";
import { StatusBox } from "@/components/feedback/status-box";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createManualMatch,
  deleteMatch,
  updateMatchPlayers,
} from "@/features/club-record/services/assignment";
import { submitMatchResult, updateMatchResult } from "@/features/club-record/services/results";
import type { ClubRecordAccessContext } from "@/features/club-record/types/access";
import type { ClubRecordMatchPlayer } from "@/features/club-record/types/match";
import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";
import type { ClubRecordAssignmentBoardSlot } from "@/features/club-record/types/slot";
import { parseClubRecordScoreText } from "@/features/club-record/utils/score";

type ClubRecordMatchControlsProps = {
  eventId: string;
  slot: ClubRecordAssignmentBoardSlot;
  participants: ClubRecordEventParticipant[];
  swapEligibleParticipantIds: string[];
  access: ClubRecordAccessContext | null;
  onChanged: () => Promise<void>;
  readOnly?: boolean;
};

type StatusState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type ResultEntryState =
  | "member-editable"
  | "admin-editable"
  | "locked-confirmed"
  | "locked-cancelled"
  | "locked-not-participant"
  | "locked-no-permission"
  | "none";

const playerPositions: Array<{
  key: string;
  label: string;
  side: 1 | 2;
  position: 1 | 2;
}> = [
  { key: "side1-position1", label: "팀 1 선수 1", side: 1, position: 1 },
  { key: "side1-position2", label: "팀 1 선수 2", side: 1, position: 2 },
  { key: "side2-position1", label: "팀 2 선수 1", side: 2, position: 1 },
  { key: "side2-position2", label: "팀 2 선수 2", side: 2, position: 2 },
];

function buildParticipantNameMap(participants: ClubRecordEventParticipant[]) {
  const map = new Map<string, string>();
  for (const participant of participants) {
    map.set(participant.id, participant.displayName);
  }
  return map;
}

function formatMatchTeam(
  players: NonNullable<ClubRecordAssignmentBoardSlot["match"]>["players"],
  side: 1 | 2,
) {
  const names = players
    .filter((player) => player.side === side)
    .map((player) => player.displayName);
  return names.length > 0 ? names.join(" · ") : "선수 없음";
}

function getResultEntryState({
  canEditAnyResult,
  canSubmitResult,
  isCurrentMemberInMatch,
  slot,
}: {
  canEditAnyResult: boolean;
  canSubmitResult: boolean;
  isCurrentMemberInMatch: boolean;
  slot: ClubRecordAssignmentBoardSlot;
}): ResultEntryState {
  if (!slot.match) return "none";
  if (canEditAnyResult) return "admin-editable";
  if (slot.match.status === "cancelled") return "locked-cancelled";
  if (slot.match.status === "confirmed") return "locked-confirmed";
  if (!canSubmitResult) return "locked-no-permission";
  if (!isCurrentMemberInMatch) return "locked-not-participant";
  return "member-editable";
}

function getLockedResultMessage(state: ResultEntryState) {
  if (state === "locked-confirmed") {
    return "이미 확정된 경기입니다. 결과 수정은 운영진에게 요청해주세요.";
  }
  if (state === "locked-cancelled") {
    return "취소된 경기는 회원이 결과를 입력할 수 없습니다.";
  }
  if (state === "locked-not-participant") {
    return "내가 참가한 경기만 결과를 입력할 수 있습니다.";
  }
  if (state === "locked-no-permission") {
    return "회원 이상만 본인 경기 결과를 입력할 수 있습니다.";
  }
  return null;
}

function parseScorePair(scoreText: string | null | undefined) {
  if (!scoreText) return { side1: 0, side2: 0 };
  const [side1Text, side2Text] = scoreText.split("-");
  const side1 = Number(side1Text);
  const side2 = Number(side2Text);

  return {
    side1: Number.isInteger(side1) && side1 >= 0 ? side1 : 0,
    side2: Number.isInteger(side2) && side2 >= 0 ? side2 : 0,
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(9, value));
}

function ClubRecordMatchControlsImpl({
  eventId,
  slot,
  participants,
  swapEligibleParticipantIds,
  access,
  onChanged,
  readOnly = false,
}: ClubRecordMatchControlsProps) {
  const participantNameMap = useMemo(
    () => buildParticipantNameMap(participants),
    [participants],
  );
  const initialManualPlayerIds = useMemo(
    () => slot.availableParticipantIds.slice(0, 4),
    [slot.availableParticipantIds],
  );
  const initialScore = useMemo(
    () => parseScorePair(slot.match?.scoreText),
    [slot.match?.scoreText],
  );
  const [manualPlayerIds, setManualPlayerIds] = useState<string[]>(initialManualPlayerIds);
  const [side1Score, setSide1Score] = useState(initialScore.side1);
  const [side2Score, setSide2Score] = useState(initialScore.side2);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [playerPopoverOpen, setPlayerPopoverOpen] = useState([false, false, false, false]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  const initialSwapPlayerIds = useMemo(() => {
    if (!slot.match) return ["", "", "", ""] as string[];
    return playerPositions.map(
      (position) =>
        slot.match?.players.find(
          (player) =>
            player.side === position.side && player.position === position.position,
        )?.participantId ?? "",
    );
  }, [slot.match]);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapPlayerIds, setSwapPlayerIds] = useState<string[]>(initialSwapPlayerIds);
  const [swapPopoverOpen, setSwapPopoverOpen] = useState([
    false,
    false,
    false,
    false,
  ]);

  useEffect(() => {
    setManualPlayerIds(initialManualPlayerIds);
  }, [initialManualPlayerIds]);

  useEffect(() => {
    if (swapDialogOpen) return;
    setSwapPlayerIds(initialSwapPlayerIds);
  }, [initialSwapPlayerIds, swapDialogOpen]);

  useEffect(() => {
    setSide1Score(initialScore.side1);
    setSide2Score(initialScore.side2);
  }, [initialScore.side1, initialScore.side2]);

  const canManageManualMatches = Boolean(access?.capabilities.canManageManualMatches);
  const canEditAnyResult = Boolean(access?.capabilities.canEditAnyMatchResult);
  const canSubmitResult = Boolean(access?.capabilities.canSubmitMatchResult);
  const isCurrentMemberInMatch = Boolean(
    access?.clubMemberId &&
      slot.match?.players.some((player) => {
        const participant = participants.find(
          (item) => item.id === player.participantId,
        );
        return participant?.clubMemberId === access.clubMemberId;
      }),
  );
  const resultEntryState = getResultEntryState({
    canEditAnyResult,
    canSubmitResult: readOnly ? false : canSubmitResult,
    isCurrentMemberInMatch,
    slot,
  });
  const canShowResultAction =
    resultEntryState === "member-editable" || resultEntryState === "admin-editable";
  const lockedResultMessage = getLockedResultMessage(resultEntryState);
  const selectedManualPlayerIds = new Set(manualPlayerIds.filter(Boolean));
  const canCreateManualMatch =
    !readOnly &&
    canManageManualMatches &&
    !slot.match &&
    slot.availableParticipantIds.length >= 4 &&
    manualPlayerIds.length === 4 &&
    selectedManualPlayerIds.size === 4;
  const scoreText = `${side1Score}-${side2Score}`;
  const parsedScore = useMemo(() => {
    try {
      return {
        type: "success" as const,
        message: `${parseClubRecordScoreText(scoreText).normalizedScoreText} 저장 가능`,
      };
    } catch (error) {
      return {
        type: "error" as const,
        message: error instanceof Error ? error.message : "스코어 형식을 확인해주세요.",
      };
    }
  }, [scoreText]);
  const scoreHasValue = side1Score > 0 || side2Score > 0 || Boolean(slot.match?.scoreText);
  const scoreIsValid = parsedScore?.type === "success" && scoreHasValue;
  const resultActionLabel =
    resultEntryState === "admin-editable"
      ? slot.match?.scoreText
        ? "결과 수정"
        : "결과 입력"
      : "결과 입력";

  const handleManualPlayerChange = (index: number, participantId: string) => {
    setManualPlayerIds((current) => {
      const next = [...current];
      next[index] = participantId;
      return next;
    });
  };

  const updateScore = (side: 1 | 2, delta: number) => {
    if (side === 1) {
      setSide1Score((current) => clampScore(current + delta));
    } else {
      setSide2Score((current) => clampScore(current + delta));
    }
  };

  const handleCreateManualMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateManualMatch) {
      setStatus({
        type: "error",
        message: "수동 경기는 서로 다른 4명의 참가자가 필요합니다.",
      });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const players: ClubRecordMatchPlayer[] = playerPositions.map((position, index) => ({
        participantId: manualPlayerIds[index],
        side: position.side,
        position: position.position,
      }));

      await createManualMatch(eventId, {
        slotId: slot.id,
        players,
      });
      setStatus({ type: "success", message: "수동 경기를 생성했습니다." });
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "수동 경기 생성 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!slot.match) return;

    setBusy(true);
    setStatus(null);
    try {
      await deleteMatch(slot.match.id);
      setStatus({ type: "success", message: "경기를 삭제했습니다." });
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "경기 삭제 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSwapPlayerChange = (index: number, participantId: string) => {
    setSwapPlayerIds((current) => {
      const next = [...current];
      next[index] = participantId;
      return next;
    });
  };

  const handleSavePlayerSwap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slot.match) return;

    if (swapPlayerIds.some((id) => !id)) {
      setStatus({
        type: "error",
        message: "4명 모두 선택해주세요.",
      });
      return;
    }

    if (new Set(swapPlayerIds).size !== 4) {
      setStatus({
        type: "error",
        message: "서로 다른 4명을 선택해주세요.",
      });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const players: ClubRecordMatchPlayer[] = playerPositions.map(
        (position, index) => ({
          participantId: swapPlayerIds[index]!,
          side: position.side,
          position: position.position,
        }),
      );
      await updateMatchPlayers(slot.match.id, players);
      setStatus({ type: "success", message: "경기 선수를 변경했습니다." });
      setSwapDialogOpen(false);
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "선수 변경 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slot.match) return;

    setBusy(true);
    setStatus(null);
    try {
      if (canEditAnyResult) {
        await updateMatchResult(slot.match.id, { scoreText });
      } else {
        await submitMatchResult(slot.match.id, { scoreText });
      }
      setStatus({ type: "success", message: "경기 결과를 저장했습니다." });
      setResultDialogOpen(false);
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "경기 결과 저장 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!slot.match && !canManageManualMatches) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {status ? <StatusBox type={status.type} message={status.message} /> : null}

      {/* 종료된 이벤트(readOnly) 안내는 워크스페이스 상단 InfoBox 에 한 번만 표시되며,
          슬롯마다 같은 메시지를 반복하지 않는다. */}

      {!slot.match &&
      canManageManualMatches &&
      !readOnly &&
      slot.availableParticipantIds.length < 4 ? (
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          수동 편성에는 이 시간대에 출전 가능한 참가자 4명이 필요합니다.
        </div>
      ) : null}

      {!slot.match &&
      canManageManualMatches &&
      !readOnly &&
      slot.availableParticipantIds.length >= 4 ? (
        <form className="space-y-3" onSubmit={handleCreateManualMatch}>
          <div className="grid gap-2 sm:grid-cols-2">
            {playerPositions.map((position, index) => (
              <div key={position.key} className="grid gap-1.5">
                <Label className="text-xs">{position.label}</Label>
                <Popover
                  open={playerPopoverOpen[index]}
                  onOpenChange={(open) =>
                    setPlayerPopoverOpen((prev) => {
                      const next = [...prev];
                      next[index] = open;
                      return next;
                    })
                  }
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-between rounded-xl px-3 font-normal"
                    >
                      <span className="truncate">
                        {manualPlayerIds[index]
                          ? (participantNameMap.get(manualPlayerIds[index] ?? "") ?? "알 수 없음")
                          : <span className="text-muted-foreground">선택</span>}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-48 p-1">
                    <div className="space-y-0.5">
                      {slot.availableParticipantIds.map((participantId) => (
                        <Button
                          key={participantId}
                          type="button"
                          variant={manualPlayerIds[index] === participantId ? "secondary" : "outline"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            handleManualPlayerChange(index, participantId);
                            setPlayerPopoverOpen((prev) => {
                              const next = [...prev];
                              next[index] = false;
                              return next;
                            });
                          }}
                        >
                          {participantNameMap.get(participantId) ?? participantId}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>
          <Button
            type="submit"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy || !canCreateManualMatch}
          >
            <UsersRound className="size-4" />
            {busy ? "생성 중..." : "수동 경기 생성"}
          </Button>
        </form>
      ) : null}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>경기 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 경기를 삭제할까요? 확정된 경기는 삭제할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={() => void handleDeleteMatch()}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {slot.match ? (
        <div className="space-y-3">
          {canShowResultAction ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1 sm:flex-none"
                variant={resultEntryState === "admin-editable" ? "outline" : "default"}
                disabled={busy}
                onClick={() => setResultDialogOpen(true)}
              >
                {resultEntryState === "admin-editable" ? (
                  <Pencil className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                {resultActionLabel}
              </Button>
              {!readOnly && canManageManualMatches && slot.match.status !== "confirmed" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="size-9 p-0">
                      <MoreVertical className="size-4" />
                      <span className="sr-only">경기 메뉴</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={busy}
                      onSelect={() => setSwapDialogOpen(true)}
                    >
                      <UsersRound className="size-4" />
                      선수 변경
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={busy}
                      onSelect={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="size-4" />
                      경기 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ) : lockedResultMessage ? (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {lockedResultMessage}
            </div>
          ) : null}

          <Modal
            open={resultDialogOpen}
            onOpenChange={setResultDialogOpen}
            title={resultEntryState === "admin-editable" ? "결과 수정" : "결과 입력"}
            description="팀별 점수를 버튼으로 조정해 경기 결과를 저장합니다."
          >
            <form className="space-y-4" onSubmit={handleSaveResult}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">팀 1</p>
                  <p className="mt-1 break-words text-sm font-medium">
                    {formatMatchTeam(slot.match.players, 1)}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">팀 2</p>
                  <p className="mt-1 break-words text-sm font-medium">
                    {formatMatchTeam(slot.match.players, 2)}
                  </p>
                </div>
              </div>

              {resultEntryState === "admin-editable" ? (
                <StatusBox
                  type="info"
                  message="운영진 수정은 확정 결과를 덮어씁니다. 점수를 다시 확인한 뒤 저장해주세요."
                />
              ) : null}

              <div className="space-y-3">
                <Label className="text-xs">스코어</Label>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
                    <p className="line-clamp-2 min-h-10 text-center text-sm font-medium">
                      {formatMatchTeam(slot.match.players, 1)}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-9 p-0"
                        onClick={() => updateScore(1, -1)}
                        disabled={side1Score === 0}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <div className="flex h-14 min-w-14 items-center justify-center rounded-xl bg-background text-3xl font-semibold tabular-nums">
                        {side1Score}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-9 p-0"
                        onClick={() => updateScore(1, 1)}
                        disabled={side1Score === 9}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="hidden text-center text-lg font-semibold text-muted-foreground sm:block">
                    -
                  </div>
                  <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
                    <p className="line-clamp-2 min-h-10 text-center text-sm font-medium">
                      {formatMatchTeam(slot.match.players, 2)}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-9 p-0"
                        onClick={() => updateScore(2, -1)}
                        disabled={side2Score === 0}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <div className="flex h-14 min-w-14 items-center justify-center rounded-xl bg-background text-3xl font-semibold tabular-nums">
                        {side2Score}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-9 p-0"
                        onClick={() => updateScore(2, 1)}
                        disabled={side2Score === 9}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {parsedScore ? (
                <StatusBox type={parsedScore.type} message={parsedScore.message} />
              ) : null}

              <div className="grid gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || !scoreIsValid}
                >
                  <Save className="size-4" />
                  {busy ? "저장 중..." : resultActionLabel}
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setResultDialogOpen(false)}
                >
                  취소
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={swapDialogOpen}
            onOpenChange={setSwapDialogOpen}
            title="경기 선수 변경"
            description="이 슬롯에 출전 가능한 참가자 중에서 새 4명을 선택합니다."
          >
            <form className="space-y-4" onSubmit={handleSavePlayerSwap}>
              <div className="grid gap-2 sm:grid-cols-2">
                {playerPositions.map((position, index) => (
                  <div key={position.key} className="grid gap-1.5">
                    <Label className="text-xs">{position.label}</Label>
                    <Popover
                      open={swapPopoverOpen[index]}
                      onOpenChange={(open) =>
                        setSwapPopoverOpen((prev) => {
                          const next = [...prev];
                          next[index] = open;
                          return next;
                        })
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-between rounded-xl px-3 font-normal"
                        >
                          <span className="truncate">
                            {swapPlayerIds[index] ? (
                              (participantNameMap.get(swapPlayerIds[index] ?? "") ??
                                "알 수 없음")
                            ) : (
                              <span className="text-muted-foreground">선택</span>
                            )}
                          </span>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-48 p-1">
                        <div className="space-y-0.5">
                          {swapEligibleParticipantIds.length > 0 ? (
                            swapEligibleParticipantIds.map((participantId) => (
                              <Button
                                key={participantId}
                                type="button"
                                variant={
                                  swapPlayerIds[index] === participantId
                                    ? "secondary"
                                    : "outline"
                                }
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                  handleSwapPlayerChange(index, participantId);
                                  setSwapPopoverOpen((prev) => {
                                    const next = [...prev];
                                    next[index] = false;
                                    return next;
                                  });
                                }}
                              >
                                {participantNameMap.get(participantId) ?? participantId}
                              </Button>
                            ))
                          ) : (
                            <p className="px-2 py-1 text-xs text-muted-foreground">
                              이 시간대에 대체 가능한 참가자가 없습니다.
                            </p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setSwapDialogOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" className="flex-1" disabled={busy}>
                  <UsersRound className="size-4" />
                  {busy ? "저장 중..." : "변경 저장"}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      ) : null}
    </div>
  );
}

// 워크스페이스가 한 슬롯의 변경(예: 결과 입력) 후 refresh 하면 16~24개 슬롯의
// MatchControls 가 모두 re-render 되던 비용을 줄인다. props 가 동일하면 skip.
// 부모(workspace)는 swapEligibleMapBySlot, handleWorkspaceChanged 를 useMemo /
// useCallback 으로 안정화해 두었으므로 같은 reference 가 들어온다.
export const ClubRecordMatchControls = memo(ClubRecordMatchControlsImpl);
