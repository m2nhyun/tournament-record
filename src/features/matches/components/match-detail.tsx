"use client";

import Link from "next/link";
import { Check, Pencil, User, Users, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { MatchStatusBadge } from "@/features/matches/components/match-status-badge";
import { useMatchDetail } from "@/features/matches/hooks/use-match-detail";
import { AppBar } from "@/components/layout/app-bar";
import { approveMatch, rejectMatch } from "@/features/matches/services/matches";
import {
  getPendingConfirmationNames,
  getRejectedConfirmationNames,
} from "@/features/matches/utils/match-status";

type MatchDetailViewProps = {
  matchId: string;
  clubId: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function formatGameCell(sideGames: number, point?: string) {
  if (!point || point === "0") return String(sideGames);
  return `${sideGames} (${point})`;
}

function overallScore(setScores: { side1: number; side2: number }[]): {
  side1: number;
  side2: number;
} {
  let side1Wins = 0;
  let side2Wins = 0;
  for (const s of setScores) {
    if (s.side1 > s.side2) side1Wins++;
    else if (s.side2 > s.side1) side2Wins++;
  }
  return { side1: side1Wins, side2: side2Wins };
}

export function MatchDetailView({ matchId, clubId }: MatchDetailViewProps) {
  const { match, loading, error, refresh } = useMatchDetail(matchId);
  const [actionStatus, setActionStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  async function handleConfirmation(action: "approve" | "reject") {
    setSubmittingAction(true);
    setActionStatus(null);

    try {
      if (action === "approve") {
        const result = await approveMatch(matchId);
        setActionStatus({
          type: "success",
          message: result.confirmed
            ? "모든 상대 확인이 완료되어 경기 기록이 확정되었습니다."
            : `내 확인이 반영되었습니다. 아직 ${result.pendingCount}명의 상대 확인이 남아 있습니다.`,
        });
      } else {
        await rejectMatch(matchId);
        setActionStatus({
          type: "success",
          message: "경기 결과 확인을 거절했고 기록을 다시 검토해야 합니다.",
        });
      }
      await refresh();
    } catch (actionError) {
      setActionStatus({
        type: "error",
        message:
          actionError instanceof Error
            ? actionError.message
            : "경기 확인 처리 중 오류가 발생했습니다.",
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  if (loading) {
    return (
      <LoadingSpinner title="로딩 중" message="경기 정보를 불러오는 중..." />
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <AppBar title="경기 상세" showBack />
        <div className="space-y-4 px-4">
          <StatusBox type="error" message={error} />
          <Button variant="outline" asChild>
            <Link href={`/clubs/${clubId}`}>클럽 홈으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const side1 = match.players.filter((p) => p.side === 1);
  const side2 = match.players.filter((p) => p.side === 2);
  const TypeIcon = match.matchType === "singles" ? User : Users;
  const team1Name = side1.map((p) => p.nickname).join(" · ");
  const team2Name = side2.map((p) => p.nickname).join(" · ");
  const finalScore = overallScore(match.result?.setScores ?? []);
  const pendingConfirmers = getPendingConfirmationNames(match.confirmations);
  const rejectedConfirmers = getRejectedConfirmationNames(match.confirmations);
  const pendingSummary =
    pendingConfirmers.length > 0 ? pendingConfirmers.join(", ") : "없음";
  const rejectedSummary =
    rejectedConfirmers.length > 0 ? rejectedConfirmers.join(", ") : "없음";

  return (
    <div className="space-y-4">
      <AppBar
        title="경기 상세"
        showBack
        actions={
          match.canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clubs/${clubId}/matches/${matchId}/edit`}>
                <Pencil className="size-3.5" />
                수정
              </Link>
            </Button>
          ) : null
        }
        onBack={() => {
          window.location.href = `/clubs/${clubId}/history`;
        }}
      />
      <div className="px-4">
        {actionStatus ? (
          <div className="mb-4">
            <StatusBox type={actionStatus.type} message={actionStatus.message} />
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TypeIcon className="size-4 text-muted-foreground" />
                <CardTitle>
                  {match.matchType === "singles" ? "단식" : "복식"}
                </CardTitle>
              </div>
              <MatchStatusBadge status={match.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatDateTime(match.playedAt)}
            </p>

            {match.status === "submitted" ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">
                  {match.canApprove || match.canReject
                    ? "내 확인 요청이 도착했습니다. 아래에서 승인 또는 거절할 수 있습니다."
                    : "경기 기록은 저장되었고, 상대 확인이 끝나면 확정됩니다."}
                </p>
                {match.confirmations.length > 0 ? (
                  <p className="text-xs text-amber-800">
                    확인 대상: {pendingSummary}
                  </p>
                ) : null}
              </div>
            ) : null}

            {match.status === "submitted" &&
            !match.canApprove &&
            !match.canReject &&
            match.confirmations.length > 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                이 화면에서는 현재 확인 상태만 볼 수 있습니다. 승인 버튼은 확인 요청을 받은 상대 팀에게만 노출됩니다.
              </div>
            ) : null}

            {match.status === "disputed" ? (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-medium">
                  경기 결과에 이견이 있어 재검토가 필요합니다.
                </p>
                {match.confirmations.length > 0 ? (
                  <p className="text-xs text-red-800">
                    거절한 확인 대상: {rejectedSummary}
                  </p>
                ) : null}
                <p className="text-xs text-red-800">
                  {match.canEdit
                    ? "점수나 선수 구성을 수정한 뒤 다시 저장하면 새 확인 요청이 전송됩니다."
                    : "수정 권한이 있는 클럽장, 매니저 또는 기록 작성자가 다시 제출해야 합니다."}
                </p>
              </div>
            ) : null}

            {match.result ? (
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="text-sm font-semibold">
                    {team1Name || "팀 A"}
                  </div>
                  <p className="font-mono text-2xl font-bold text-[var(--brand)]">
                    {finalScore.side1} : {finalScore.side2}
                  </p>
                  <div className="text-right text-sm font-semibold">
                    {team2Name || "팀 B"}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Set scores table */}
            {match.result && match.result.setScores.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  게임 상세
                </p>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          게임
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                          {team1Name || "팀 A"}
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                          {team2Name || "팀 B"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.result.setScores.map((s) => (
                        <tr key={s.set} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">
                            {s.set}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {formatGameCell(s.side1, s.side1Point)}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {formatGameCell(s.side2, s.side2Point)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {match.confirmations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  상대 확인 상태
                </p>
                <div className="space-y-2">
                  {match.confirmations.map((confirmation) => (
                    <div
                      key={confirmation.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>{confirmation.nickname}</span>
                      <span className="text-muted-foreground">
                        {confirmation.decision === "pending"
                          ? "확인 대기"
                          : confirmation.decision === "approved"
                            ? "확인 완료"
                            : "거절"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {match.canApprove || match.canReject ? (
              <div className="flex gap-2">
                {match.canReject ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    disabled={submittingAction}
                    onClick={() => {
                      void handleConfirmation("reject");
                    }}
                  >
                    <X className="size-4" />
                    거절
                  </Button>
                ) : null}
                {match.canApprove ? (
                  <Button
                    type="button"
                    className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
                    disabled={submittingAction}
                    onClick={() => {
                      void handleConfirmation("approve");
                    }}
                  >
                    <Check className="size-4" />
                    결과 확인
                  </Button>
                ) : null}
              </div>
            ) : null}

            {match.status === "disputed" && match.canEdit ? (
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/clubs/${clubId}/matches/${matchId}/edit`}>
                  <Pencil className="size-4" />
                  수정 후 다시 확인 요청
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
