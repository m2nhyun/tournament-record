"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Pencil, PlusCircle, Users, X } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBox } from "@/components/feedback/status-box";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClubMemberList } from "@/features/clubs/components/club-member-list";
import { useClubDetail } from "@/features/clubs/hooks/use-club-detail";

type ClubDetailViewProps = {
  clubId: string;
};

const roleLabelMap: Record<string, string> = {
  owner: "방장",
  manager: "매니저",
  member: "멤버",
};

export function ClubDetailView({ clubId }: ClubDetailViewProps) {
  const { club, members, loading, status, saving, saveClubName, saveMySettings } =
    useClubDetail(clubId);
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

  async function submitClubName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!club) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("clubName") ?? "").trim();
    if (name.length < 2 || name === club.name) return;
    await saveClubName(name);
    setOpenNameDialog(false);
  }

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
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {club.myRole === "owner"
              ? "연필 아이콘을 눌러 클럽 이름을 수정할 수 있습니다."
              : "클럽 이름은 클럽장만 변경할 수 있습니다."}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">참가 코드</p>
              <p className="font-mono text-sm font-semibold tracking-wider">
                {club.inviteCode}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyInviteCode()}
            >
              <Copy className="size-3.5" />
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {club.myRole === "owner" && openNameDialog ? (
        <div className="fixed inset-0 z-50 bg-black/40 px-4 py-8">
          <div className="mx-auto w-full max-w-md rounded-xl border bg-background p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">클럽 이름 변경</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenNameDialog(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <form
              key={`club-name-dialog-${club.name}`}
              onSubmit={(e) => void submitClubName(e)}
              className="space-y-3"
            >
              <Input
                name="clubName"
                defaultValue={club.name}
                minLength={2}
                maxLength={24}
                placeholder="클럽 이름"
                disabled={saving}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenNameDialog(false)}
                  disabled={saving}
                >
                  취소
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
