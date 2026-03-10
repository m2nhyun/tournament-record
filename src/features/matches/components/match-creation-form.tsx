"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/common/modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { MatchTypeSelector } from "@/features/matches/components/match-type-selector";
import { PlayerSelector } from "@/features/matches/components/player-selector";
import { ScoreInput } from "@/features/matches/components/score-input";
import { AppBar } from "@/components/layout/app-bar";
import { ClubSwitcherAction } from "@/components/layout/club-switcher-action";
import {
  useMatchCreation,
  type CreationStep,
} from "@/features/matches/hooks/use-match-creation";

type MatchCreationFormProps = {
  clubId: string;
  matchId?: string;
};

const stepLabels: Record<CreationStep, string> = {
  type: "경기 유형",
  players: "선수 선택",
  score: "점수 입력",
};

const stepNumbers: Record<CreationStep, number> = {
  type: 1,
  players: 2,
  score: 3,
};

export function MatchCreationForm({ clubId, matchId }: MatchCreationFormProps) {
  const {
    step,
    members,
    loadingMembers,
    submitting,
    deleting,
    status,
    createdMatchId,
    deletedMatch,
    isEditMode,
    matchType,
    setMatchType,
    playedAt,
    setPlayedAt,
    side1Ids,
    side2Ids,
    togglePlayer,
    requiredPerSide,
    canCreateAnyMatch,
    canRecordMatch,
    canUseDoubles,
    setScores,
    gamesToWin,
    setGamesToWin,
    addSet,
    removeLastSet,
    removeSet,
    updateSetScore,
    canGoToPlayers,
    canGoToScore,
    canSubmit,
    goToPlayers,
    goToScore,
    goBack,
    submit,
    deleteCurrentMatch,
  } = useMatchCreation(clubId, matchId);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const side1Label =
    side1Ids
      .map((id) => members.find((member) => member.id === id)?.nickname)
      .filter((name): name is string => Boolean(name))
      .join(" · ") || "팀 A";

  const side2Label =
    side2Ids
      .map((id) => members.find((member) => member.id === id)?.nickname)
      .filter((name): name is string => Boolean(name))
      .join(" · ") || "팀 B";

  if (deletedMatch) {
    return (
      <div className="space-y-4 p-4">
        <AppBar />
        <StatusBox type="success" message="경기가 삭제되었습니다." />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/clubs/${clubId}`}>클럽 홈</Link>
          </Button>
          <Button
            className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
            asChild
          >
            <Link href={`/clubs/${clubId}/history`}>경기 히스토리</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (createdMatchId) {
    return (
      <div className="space-y-4 p-4">
        <StatusBox
          type="success"
          message={
            isEditMode
              ? "경기 기록이 수정되었고 다시 상대 확인 대기 상태가 되었습니다."
              : "경기가 저장되었고 상대 확인 요청을 보냈습니다."
          }
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/clubs/${clubId}`}>클럽 홈</Link>
          </Button>
          <Button
            className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
            asChild
          >
            <Link href={`/clubs/${clubId}/matches/${createdMatchId}`}>
              경기 상세 보기
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loadingMembers) {
    return (
      <LoadingSpinner title="로딩 중" message="멤버 정보를 불러오는 중..." />
    );
  }

  if (!canCreateAnyMatch) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <AppBar
          title={isEditMode ? "경기 수정" : "새 경기 기록"}
          showBack={false}
          actions={<ClubSwitcherAction />}
        />
        <div className="px-4">
          <EmptyState
            icon={Users}
            title="참가 가능한 멤버가 부족합니다."
            description="경기를 기록하려면 최소 2명의 클럽 멤버가 필요합니다."
            actionLabel="클럽 홈으로 이동"
            onAction={() => {
              window.location.href = `/clubs/${clubId}`;
            }}
          />
        </div>
      </div>
    );
  }

  if (!canRecordMatch) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <AppBar
          title={isEditMode ? "경기 수정" : "새 경기 기록"}
          showBack={false}
          actions={<ClubSwitcherAction />}
        />
        <div className="px-4">
          <EmptyState
            icon={Users}
            title="게스트는 경기 저장이 불가합니다."
            description="경기 조회/참가는 가능하며, 기록 저장은 정회원(카카오/이메일)만 가능합니다."
            actionLabel="클럽 홈으로 이동"
            onAction={() => {
              window.location.href = `/clubs/${clubId}`;
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <AppBar
        title={isEditMode ? "경기 수정" : "새 경기 기록"}
        showBack={false}
        actions={<ClubSwitcherAction />}
      />
      <div className="space-y-4 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(["type", "players", "score"] as CreationStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 ? <div className="h-px w-4 bg-border" /> : null}
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                  stepNumbers[step] >= stepNumbers[s]
                    ? "bg-[var(--brand)] text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stepNumbers[s]}
              </div>
              <span
                className={`text-xs ${
                  step === s
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {stepLabels[s]}
              </span>
            </div>
          ))}
        </div>

        {status ? (
          <StatusBox type={status.type} message={status.message} />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{stepLabels[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === "type" ? (
              <MatchTypeSelector
                matchType={matchType}
                playedAt={playedAt}
                canUseDoubles={canUseDoubles}
                onChangeType={setMatchType}
                onChangeDate={setPlayedAt}
              />
            ) : null}

            {step === "players" ? (
              <PlayerSelector
                members={members}
                side1Ids={side1Ids}
                side2Ids={side2Ids}
                requiredPerSide={requiredPerSide}
                onToggle={togglePlayer}
              />
            ) : null}

            {step === "score" ? (
              <ScoreInput
                setScores={setScores}
                onUpdate={updateSetScore}
                onAddSet={addSet}
                onRemoveLastSet={removeLastSet}
                onRemoveSet={removeSet}
                gamesToWin={gamesToWin}
                onChangeGamesToWin={setGamesToWin}
                side1Label={side1Label}
                side2Label={side2Label}
              />
            ) : null}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          {step !== "type" ? (
            <Button variant="outline" className="flex-1" onClick={goBack}>
              <ChevronLeft className="size-4" />
              이전
            </Button>
          ) : null}

          {step === "type" ? (
            <Button
              className="w-full bg-[var(--brand)] text-white hover:opacity-90"
              disabled={!canGoToPlayers}
              onClick={goToPlayers}
            >
              다음
              <ChevronRight className="size-4" />
            </Button>
          ) : null}

          {step === "players" ? (
            <Button
              className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
              disabled={!canGoToScore}
              onClick={goToScore}
            >
              다음
              <ChevronRight className="size-4" />
            </Button>
          ) : null}

          {step === "score" ? (
            isEditMode && setScores.length === 0 ? (
              <Button
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                variant="outline"
                disabled={deleting}
                onClick={() => setOpenDeleteDialog(true)}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                경기 삭제
              </Button>
            ) : (
              <Button
                className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
                disabled={!canSubmit || submitting}
                onClick={() => void submit()}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {submitting
                  ? isEditMode
                    ? "수정 중..."
                    : "저장 중..."
                  : isEditMode
                    ? "경기 수정"
                    : "경기 저장"}
              </Button>
            )
          ) : null}
        </div>
      </div>

      <Modal
        open={openDeleteDialog}
        onOpenChange={setOpenDeleteDialog}
        title="경기를 삭제할까요?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            삭제하면 선수 배정과 점수 기록도 함께 사라집니다. 이 작업은 되돌릴
            수 없습니다.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpenDeleteDialog(false)}
            >
              취소
            </Button>
            <Button
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={() => {
                void deleteCurrentMatch().then(() => {
                  setOpenDeleteDialog(false);
                });
              }}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
