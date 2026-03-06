"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { MatchTypeSelector } from "@/features/matches/components/match-type-selector";
import { PlayerSelector } from "@/features/matches/components/player-selector";
import { ScoreInput } from "@/features/matches/components/score-input";
import { AppBar } from "@/components/layout/app-bar";
import {
  useMatchCreation,
  type CreationStep,
} from "@/features/matches/hooks/use-match-creation";

type MatchCreationFormProps = {
  clubId: string;
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

export function MatchCreationForm({ clubId }: MatchCreationFormProps) {
  const {
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
    canCreateAnyMatch,
    canRecordMatch,
    canUseDoubles,
    setScores,
    gamesToWin,
    setGamesToWin,
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
  } = useMatchCreation(clubId);

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

  if (createdMatchId) {
    return (
      <div className="space-y-4">
        <StatusBox type="success" message="경기가 성공적으로 기록되었습니다!" />
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
    return <LoadingSpinner title="로딩 중" message="멤버 정보를 불러오는 중..." />;
  }

  if (!canCreateAnyMatch) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <AppBar
          title="새 경기 기록"
          showBack
          onBack={() => {
            window.location.href = `/clubs/${clubId}`;
          }}
        />

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
    );
  }

  if (!canRecordMatch) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <AppBar
          title="새 경기 기록"
          showBack
          onBack={() => {
            window.location.href = `/clubs/${clubId}`;
          }}
        />

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
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <AppBar
        title="새 경기 기록"
        showBack
        onBack={() => {
          window.location.href = `/clubs/${clubId}`;
        }}
      />

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
            {submitting ? "저장 중..." : "경기 저장"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
