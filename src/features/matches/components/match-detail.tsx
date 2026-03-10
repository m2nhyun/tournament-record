"use client";

import Link from "next/link";
import { Pencil, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { MatchStatusBadge } from "@/features/matches/components/match-status-badge";
import { useMatchDetail } from "@/features/matches/hooks/use-match-detail";
import { AppBar } from "@/components/layout/app-bar";

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
  const { match, loading, error } = useMatchDetail(matchId);

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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
