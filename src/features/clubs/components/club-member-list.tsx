import { useState } from "react";
import { Pencil, UserX } from "lucide-react";

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
import { MyMemberSettingsModal } from "@/features/clubs/components/my-member-settings-modal";
import type { ClubMember } from "@/features/clubs/types/club";

type ClubMemberListProps = {
  members: ClubMember[];
  myRole: ClubMember["role"];
  saving: boolean;
  onSaveMySettings: (input: {
    nickname: string;
    openKakaoProfile: boolean;
    allowRecordSearch: boolean;
    shareHistory: boolean;
  }) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
};

const roleLabelMap: Record<string, string> = {
  owner: "방장",
  manager: "매니저",
  member: "멤버",
  guest: "게스트",
};

export function ClubMemberList({
  members,
  myRole,
  saving,
  onSaveMySettings,
  onRemoveMember,
}: ClubMemberListProps) {
  const myMember = members.find((member) => member.isMe) ?? null;
  const [open, setOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ClubMember | null>(null);

  return (
    <div className="grid gap-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="rounded-lg border bg-card px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium">
              {member.nickname}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {member.isMe ? (
                <Badge variant="warning" className="text-[10px]">
                  나
                </Badge>
              ) : null}
              <Badge variant={member.role === "owner" ? "brand" : "default"}>
                {roleLabelMap[member.role] ?? member.role}
              </Badge>
              {member.isMe ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(true)}
                  aria-label="내 정보 수정"
                >
                  <Pencil className="size-3.5" />
                  설정
                </Button>
              ) : null}
              {myRole === "owner" && !member.isMe && member.role !== "owner" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => setMemberToRemove(member)}
                  aria-label={`${member.nickname} 클럽에서 제외`}
                >
                  <UserX className="size-3.5" />
                  제외
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {myMember ? (
        <MyMemberSettingsModal
          open={open}
          onOpenChange={setOpen}
          saving={saving}
          member={myMember}
          onSave={onSaveMySettings}
        />
      ) : null}

      <AlertDialog
        open={memberToRemove !== null}
        onOpenChange={(next) => {
          if (!next) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>멤버 제외</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.nickname ?? ""} 님을 클럽에서 제외할까요? 과거
              기록은 그대로 유지됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>닫기</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={() => {
                if (!memberToRemove) return;
                const target = memberToRemove;
                setMemberToRemove(null);
                void onRemoveMember(target.id);
              }}
            >
              제외
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
