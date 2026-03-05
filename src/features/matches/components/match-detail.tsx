"use client";

import Link from "next/link";
import { ArrowLeft, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { MatchStatusBadge } from "@/features/matches/components/match-status-badge";
import { useMatchDetail } from "@/features/matches/hooks/use-match-detail";

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

export function MatchDetailView({ matchId, clubId }: MatchDetailViewProps) {
  const { match, loading, error } = useMatchDetail(matchId);

  if (loading) {
    return <LoadingSpinner message="경기 정보를 불러오는 중..." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <StatusBox type="error" message={error} />
        <Button variant="outline" asChild>
          <Link href={`/clubs/${clubId}`}>
            <ArrowLeft className="size-4" />
            클럽 홈으로
          </Link>
        </Button>
      </div>
    );
  }

  if (!match) return null;

  const side1 = match.players.filter((p) => p.side === 1);
  const side2 = match.players.filter((p) => p.side === 2);
  const TypeIcon = match.matchType === "singles" ? User : Users;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clubs/${clubId}/history`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">경기 상세</h1>
      </div>

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

          {/* Score summary */}
          {match.result ? (
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <p className="font-mono text-2xl font-bold text-[var(--brand)]">
                {match.result.scoreSummary}
              </p>
            </div>
          ) : null}

          {/* Players */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                사이드 1
              </p>
              {side1.map((p) => (
                <p key={p.clubMemberId} className="text-sm font-medium">
                  {p.nickname}
                </p>
              ))}
            </div>
            <div className="space-y-1.5 text-right">
              <p className="text-xs font-semibold text-muted-foreground">
                사이드 2
              </p>
              {side2.map((p) => (
                <p key={p.clubMemberId} className="text-sm font-medium">
                  {p.nickname}
                </p>
              ))}
            </div>
          </div>

          {/* Set scores table */}
          {match.result && match.result.setScores.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                세트별 게임 스코어
              </p>
              <p className="text-[11px] text-muted-foreground">
                목표 게임: {match.result.setScores[0]?.gamesToWin ?? 6}게임
              </p>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        세트
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                        사이드 1
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                        사이드 2
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                        포인트
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
                          {s.side1}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">
                          {s.side2}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {s.side1Point ?? "0"} : {s.side2Point ?? "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
