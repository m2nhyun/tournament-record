"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Users } from "lucide-react";

import { AppBar } from "@/components/layout/app-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubRanking } from "@/features/club-record/hooks/use-club-ranking";
import { useClubRecordAccess } from "@/features/club-record/hooks/use-club-record-access";

type ClubRecordRankingViewProps = {
  clubId: string;
};

export function ClubRecordRankingView({ clubId }: ClubRecordRankingViewProps) {
  const {
    access,
    loading: accessLoading,
    error: accessError,
  } = useClubRecordAccess(clubId);
  const canViewRanking = access?.capabilities.canViewRanking ?? false;
  const { members, loading, error, move, refresh, syncMembers } =
    useClubRanking(clubId, canViewRanking);
  const [status, setStatus] = useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  if (accessLoading || (canViewRanking && loading)) {
    return (
      <LoadingSpinner
        title="로딩 중"
        message="클럽 회원 랭킹을 불러오는 중..."
      />
    );
  }

  if (accessError || error || !access) {
    return (
      <div className="space-y-4">
        <AppBar title="클럽 회원 랭킹" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox
            type="error"
            message={accessError ?? error ?? "랭킹을 불러오지 못했습니다."}
          />
        </div>
      </div>
    );
  }

  if (!access.capabilities.canViewRanking) {
    return (
      <div className="space-y-4">
        <AppBar title="클럽 회원 랭킹" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox
            type="error"
            message="랭킹은 운영진 이상만 조회할 수 있습니다."
          />
        </div>
      </div>
    );
  }

  const canEdit = access.capabilities.canEditRanking;

  const handleMove = async (clubMemberId: string, targetPosition: number) => {
    setBusyMemberId(clubMemberId);
    setStatus(null);
    try {
      await move({ clubMemberId, targetPosition });
      setStatus({ type: "success", message: "랭킹 순서를 변경했습니다." });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "랭킹 변경 실패",
      });
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleSyncMembers = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const insertedCount = await syncMembers();
      setStatus({
        type: "success",
        message:
          insertedCount > 0
            ? `${insertedCount}명의 활성 회원을 랭킹에 추가했습니다.`
            : "추가할 활성 회원이 없습니다.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "클럽 회원 불러오기 실패",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <AppBar
        title="클럽 회원 랭킹"
        actions={
          <Button
            size="sm"
            variant="outline"
            aria-label="랭킹 다시 불러오기"
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      <div className="space-y-4 px-4 pb-24">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base font-semibold">클럽 회원 랭킹</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  자동 편성 시 우선순위로 사용하는 회원 순서입니다.
                </p>
              </div>
              <Badge variant={canEdit ? "brand" : "default"}>{access.roleLabel}</Badge>
            </div>
            {canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSyncMembers()}
                disabled={syncing}
              >
                <Users className="size-4" />
                {syncing ? "불러오는 중..." : "클럽 회원 불러오기"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="아직 클럽 회원 랭킹이 없습니다."
            description="활성 클럽 회원을 불러온 뒤 순서를 조정하세요."
            actionLabel={canEdit ? "클럽 회원 불러오기" : undefined}
            onAction={canEdit ? () => void handleSyncMembers() : undefined}
          />
        ) : null}

        {members.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>회원 순서</CardTitle>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSyncMembers()}
                    disabled={syncing}
                  >
                    {syncing ? "불러오는 중..." : "클럽 회원 불러오기"}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map((member, index) => {
                const canMoveUp = canEdit && index > 0;
                const canMoveDown = canEdit && index < members.length - 1;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 rounded-xl border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {member.rankingPosition}
                      </div>
                      <p className="min-w-0 break-words font-medium">
                        {member.nickname}
                      </p>
                    </div>

                    {canEdit ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canMoveUp || busyMemberId === member.clubMemberId}
                          onClick={() =>
                            void handleMove(member.clubMemberId, member.rankingPosition - 1)
                          }
                        >
                          <ChevronUp className="size-4" />
                          위
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canMoveDown || busyMemberId === member.clubMemberId}
                          onClick={() =>
                            void handleMove(member.clubMemberId, member.rankingPosition + 1)
                          }
                        >
                          <ChevronDown className="size-4" />
                          아래
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
