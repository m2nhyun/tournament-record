import { useState } from "react";
import { Pencil, UserX } from "lucide-react";

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
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
              {myRole === "owner" && !member.isMe && member.role !== "owner" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    const ok = window.confirm(
                      `${member.nickname} 님을 클럽에서 제외할까요?`,
                    );
                    if (!ok) return;
                    void onRemoveMember(member.id);
                  }}
                >
                  <UserX className="size-3.5" />
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
    </div>
  );
}
