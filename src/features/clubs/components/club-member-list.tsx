import { FormEvent, useState } from "react";
import { Pencil, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClubMember } from "@/features/clubs/types/club";

type ClubMemberListProps = {
  members: ClubMember[];
  saving: boolean;
  onSaveMySettings: (input: {
    nickname: string;
    openKakaoProfile: boolean;
    allowRecordSearch: boolean;
    shareHistory: boolean;
  }) => Promise<void>;
};

const roleLabelMap: Record<string, string> = {
  owner: "방장",
  manager: "매니저",
  member: "멤버",
};

export function ClubMemberList({
  members,
  saving,
  onSaveMySettings,
}: ClubMemberListProps) {
  const myMember = members.find((member) => member.isMe) ?? null;
  const [open, setOpen] = useState(false);

  async function submitMySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!myMember) return;
    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("myNickname") ?? "").trim();
    if (nickname.length < 2 || nickname.length > 24) return;

    await onSaveMySettings({
      nickname,
      openKakaoProfile: formData.get("openKakaoProfile") === "on",
      allowRecordSearch: formData.get("allowRecordSearch") === "on",
      shareHistory: formData.get("shareHistory") === "on",
    });
    setOpen(false);
  }

  return (
    <div className="grid gap-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="rounded-lg border bg-card px-3 py-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{member.nickname}</span>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </div>
      ))}

      {myMember && open ? (
        <div className="fixed inset-0 z-50 bg-black/40 px-4 py-8">
          <div className="mx-auto w-full max-w-md rounded-xl border bg-background p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">내 설정</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <form
              key={`my-settings-${myMember.id}-${myMember.nickname}-${myMember.openKakaoProfile}-${myMember.allowRecordSearch}-${myMember.shareHistory}`}
              onSubmit={(e) => void submitMySettings(e)}
              className="space-y-3"
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">내 닉네임</p>
                <Input
                  name="myNickname"
                  defaultValue={myMember.nickname}
                  minLength={2}
                  maxLength={24}
                  disabled={saving}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  name="openKakaoProfile"
                  type="checkbox"
                  defaultChecked={myMember.openKakaoProfile}
                  disabled={saving}
                />
                카카오톡 프로필 공개
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  name="allowRecordSearch"
                  type="checkbox"
                  defaultChecked={myMember.allowRecordSearch}
                  disabled={saving}
                />
                전적 검색 허용
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  name="shareHistory"
                  type="checkbox"
                  defaultChecked={myMember.shareHistory}
                  disabled={saving}
                />
                내 경기 히스토리 공개
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
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
