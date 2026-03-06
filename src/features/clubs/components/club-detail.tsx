"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Pencil,
  PlusCircle,
  RefreshCw,
  Share2,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClubMemberList } from "@/features/clubs/components/club-member-list";
import { ClubNameEditModal } from "@/features/clubs/components/club-name-edit-modal";
import { useClubDetail } from "@/features/clubs/hooks/use-club-detail";

type ClubDetailViewProps = {
  clubId: string;
};

const roleLabelMap: Record<string, string> = {
  owner: "방장",
  manager: "매니저",
  member: "멤버",
  guest: "게스트",
};

export function ClubDetailView({ clubId }: ClubDetailViewProps) {
  const {
    club,
    members,
    loading,
    status,
    saving,
    saveClubName,
    saveMySettings,
    regenerateInviteCode,
  } = useClubDetail(clubId);
  const [copied, setCopied] = useState(false);
  const [openNameDialog, setOpenNameDialog] = useState(false);

  const copyInviteCode = useCallback(async () => {
    if (!club) return;
    try {
      await navigator.clipboard.writeText(club.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [club]);

  const copyInviteLink = useCallback(async () => {
    if (!club || typeof window === "undefined") return;
    const inviteUrl = `${window.location.origin}/join/${club.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [club]);

  const shareInviteToKakao = useCallback(async () => {
    if (!club || typeof window === "undefined") return;
    const inviteUrl = `${window.location.origin}/join/${club.inviteCode}`;
    const shareText = `[${club.name}] 클럽 초대 링크\n${inviteUrl}`;

    if (navigator.share) {
      await navigator.share({
        title: `${club.name} 초대`,
        text: shareText,
        url: inviteUrl,
      });
      return;
    }

    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [club]);

  if (loading) {
    return <LoadingSpinner message="클럽 정보를 불러오는 중..." />;
  }

  if (status?.type === "error") {
    return (
      <div className="space-y-4">
        <StatusBox type="error" message={status.message} />
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            홈으로 돌아가기
          </Link>
        </Button>
      </div>
    );
  }

  if (!club) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="truncate text-xl font-semibold">{club.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>클럽 정보</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="brand">
                {roleLabelMap[club.myRole] ?? club.myRole}
              </Badge>
              {club.myRole === "owner" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenNameDialog(true)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {club.myRole === "owner" ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              연필 아이콘을 눌러 클럽 이름을 수정할 수 있습니다.
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">참가 코드</p>
              <p className="font-mono text-sm font-semibold tracking-wider">
                {club.inviteCode}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                유효기간: {new Date(club.inviteExpiresAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyInviteCode()}
              >
                <Copy className="size-3.5" />
                {copied ? "복사됨" : "코드 복사"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyInviteLink()}
              >
                <Copy className="size-3.5" />
                링크 복사
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void shareInviteToKakao().catch(() => {
                    /* user canceled share */
                  });
                }}
              >
                <Share2 className="size-3.5" />
                카카오톡 공유
              </Button>
              {club.myRole === "owner" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => void regenerateInviteCode()}
                >
                  <RefreshCw className="size-3.5" />
                  재발급
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {club.myRole !== "guest" ? (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-[var(--brand)] text-white hover:opacity-90"
            asChild
          >
            <Link href={`/clubs/${clubId}/matches/new`}>
              <PlusCircle className="size-4" />새 경기 기록
            </Link>
          </Button>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5" />
          멤버 ({members.length})
        </h2>
        {members.length > 0 ? (
          <ClubMemberList
            members={members}
            saving={saving}
            onSaveMySettings={saveMySettings}
          />
        ) : (
          <EmptyState icon={Users} title="멤버가 없습니다." />
        )}
      </section>

      {club.myRole === "owner" ? (
        <ClubNameEditModal
          open={openNameDialog}
          onOpenChange={setOpenNameDialog}
          saving={saving}
          currentName={club.name}
          onSave={saveClubName}
        />
      ) : null}
    </div>
  );
}
