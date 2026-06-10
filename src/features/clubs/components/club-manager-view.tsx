"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";

import { AppBar } from "@/components/layout/app-bar";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubDetail } from "@/features/clubs/hooks/use-club-detail";
import { toClubErrorMessage } from "@/features/clubs/services/club-error";
import { setClubMemberRole } from "@/features/clubs/services/clubs";
import type { ClubMember } from "@/features/clubs/types/club";

type ClubManagerViewProps = {
  clubId: string;
};

type PendingChange = {
  member: ClubMember;
  nextRole: "manager" | "member";
} | null;

export function ClubManagerView({ clubId }: ClubManagerViewProps) {
  const { club, members, loading, status: detailStatus } = useClubDetail(clubId);
  const [localMembers, setLocalMembers] = useState<ClubMember[]>([]);
  const [pendingChange, setPendingChange] = useState<PendingChange>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [status, setStatus] = useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);

  useEffect(() => {
    setLocalMembers(members);
  }, [members]);

  const isOwner = club?.myRole === "owner";

  const applyRoleChange = useCallback(
    async (member: ClubMember, nextRole: "manager" | "member") => {
      setBusyMemberId(member.id);
      setStatus(null);

      const previous = localMembers;
      setLocalMembers((current) =>
        current.map((row) =>
          row.id === member.id ? { ...row, role: nextRole } : row,
        ),
      );

      try {
        await setClubMemberRole(clubId, member.id, nextRole);
        setStatus({
          type: "success",
          message:
            nextRole === "manager"
              ? `${member.nickname} 님을 운영진으로 임명했습니다.`
              : `${member.nickname} 님을 일반 회원으로 변경했습니다.`,
        });
      } catch (error) {
        setLocalMembers(previous);
        setStatus({ type: "error", message: toClubErrorMessage(error) });
      } finally {
        setBusyMemberId(null);
      }
    },
    [clubId, localMembers],
  );

  if (loading) {
    return (
      <LoadingSpinner
        title="로딩 중"
        message="클럽 멤버를 불러오는 중..."
      />
    );
  }

  if (detailStatus?.type === "error" || !club) {
    return (
      <div className="space-y-4">
        <AppBar title="운영진 관리" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox
            type="error"
            message={detailStatus?.message ?? "클럽 정보를 불러오지 못했습니다."}
          />
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <AppBar title="운영진 관리" />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox
            type="error"
            message="운영진 관리는 클럽 방장만 사용할 수 있습니다."
          />
        </div>
      </div>
    );
  }

  // owner / 본인 / 게스트는 액션 대상에서 제외. owner 는 DB 룰상 본인이지만
  // 예외 상태(직접 SQL 편집 등)에 대비해 role === "owner" 도 명시적으로 빼둔다.
  // RPC set_club_member_role 도 owner 대상 변경을 raise 로 차단한다.
  const candidates = localMembers
    .filter(
      (member) =>
        !member.isMe && member.role !== "owner" && member.role !== "guest",
    )
    .sort((a, b) => {
      if (a.role === b.role) return a.nickname.localeCompare(b.nickname);
      if (a.role === "manager") return -1;
      if (b.role === "manager") return 1;
      return 0;
    });

  return (
    <div className="space-y-6">
      <AppBar title="운영진 관리" />
      <div className="space-y-4 px-4 pb-24">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <Card className="border-[var(--brand)]/20 bg-[var(--brand)]/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base font-semibold">운영진 관리</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  운영진은 이벤트 생성, 참가자 관리, 자동 편성, 결과 입력/수정 등
                  운영 액션을 수행할 수 있습니다.
                </p>
              </div>
              <Badge variant="brand">방장</Badge>
            </div>
          </CardContent>
        </Card>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              운영진으로 임명할 수 있는 멤버가 아직 없습니다.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">멤버 ({candidates.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {candidates.map((member) => {
                const isManager = member.role === "manager";
                const busy = busyMemberId === member.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 truncate font-medium">
                        {member.nickname}
                      </p>
                      <Badge variant={isManager ? "brand" : "default"}>
                        {isManager ? "운영진" : "회원"}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={isManager ? "outline" : "default"}
                      disabled={busy}
                      onClick={() =>
                        setPendingChange({
                          member,
                          nextRole: isManager ? "member" : "manager",
                        })
                      }
                    >
                      {isManager ? (
                        <>
                          <ShieldOff className="size-4" />
                          운영진 해제
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="size-4" />
                          운영진 임명
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog
        open={pendingChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChange?.nextRole === "manager"
                ? "운영진으로 임명할까요?"
                : "운영진에서 해제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange
                ? pendingChange.nextRole === "manager"
                  ? `${pendingChange.member.nickname} 님이 운영진이 되어 이벤트 생성과 결과 관리 권한을 가집니다.`
                  : `${pendingChange.member.nickname} 님이 일반 회원으로 돌아가 운영 액션을 수행할 수 없게 됩니다.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyMemberId !== null}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busyMemberId !== null}
              onClick={() => {
                if (!pendingChange) return;
                const change = pendingChange;
                setPendingChange(null);
                void applyRoleChange(change.member, change.nextRole);
              }}
            >
              <Shield className="size-4" />
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
