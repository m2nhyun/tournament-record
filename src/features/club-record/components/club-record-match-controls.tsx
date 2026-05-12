"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Minus, MoreVertical, Pencil, Plus, Save, Trash2, UsersRound } from "lucide-react";

import { Modal } from "@/components/common/modal";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createManualMatch, deleteMatch } from "@/features/club-record/services/assignment";
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

export function ClubRecordMatchControls({
  eventId,
  slot,
  participants,
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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  useEffect(() => {
    setManualPlayerIds(initialManualPlayerIds);
  }, [initialManualPlayerIds]);

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

    const confirmed = window.confirm("이 경기를 삭제할까요? 확정된 경기는 삭제할 수 없습니다.");
    if (!confirmed) return;

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

  const handleSaveResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slot.match) return;

    if (resultEntryState === "admin-editable" && slot.match.status === "confirmed") {
      const confirmed = window.confirm(
        `${formatMatchTeam(slot.match.players, 1)} ${scoreText} ${formatMatchTeam(
          slot.match.players,
          2,
        )} 결과로 수정할까요?`,
      );
      if (!confirmed) return;
    }

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

      {!slot.match && canManageManualMatches && readOnly ? (
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          지난 이벤트에서는 새 경기를 만들 수 없습니다.
        </div>
      ) : null}

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
                <Label htmlFor={`${slot.id}-${position.key}`} className="text-xs">
                  {position.label}
                </Label>
                <select
                  id={`${slot.id}-${position.key}`}
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                  value={manualPlayerIds[index] ?? ""}
                  onChange={(event) => handleManualPlayerChange(index, event.target.value)}
                >
                  <option value="">선택</option>
                  {slot.availableParticipantIds.map((participantId) => (
                    <option key={participantId} value={participantId}>
                      {participantNameMap.get(participantId) ?? participantId}
                    </option>
                  ))}
                </select>
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
                <details className="relative">
                  <summary className="flex h-9 w-9 list-none items-center justify-center rounded-md border bg-background text-sm [&::-webkit-details-marker]:hidden">
                    <MoreVertical className="size-4" />
                    <span className="sr-only">경기 메뉴</span>
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 min-w-32 rounded-md border bg-background p-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-destructive hover:bg-muted"
                      disabled={busy}
                      onClick={() => void handleDeleteMatch()}
                    >
                      <Trash2 className="size-4" />
                      경기 삭제
                    </button>
                  </div>
                </details>
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
        </div>
      ) : null}
    </div>
  );
}
