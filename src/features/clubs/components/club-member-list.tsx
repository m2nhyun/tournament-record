import { FormEvent } from "react";

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
  }

  return (
    <div className="grid gap-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="space-y-2 rounded-lg border bg-card px-3 py-2.5"
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
            </div>
          </div>

          {member.isMe ? (
            <form
              key={`my-settings-${member.id}-${member.nickname}-${member.openKakaoProfile}-${member.allowRecordSearch}-${member.shareHistory}`}
              onSubmit={(e) => void submitMySettings(e)}
              className="space-y-2"
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">내 닉네임</p>
                <Input
                  name="myNickname"
                  defaultValue={member.nickname}
                  minLength={2}
                  maxLength={24}
                  disabled={saving}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  name="openKakaoProfile"
                  type="checkbox"
                  defaultChecked={member.openKakaoProfile}
                  disabled={saving}
                />
                카카오톡 프로필 공개
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  name="allowRecordSearch"
                  type="checkbox"
                  defaultChecked={member.allowRecordSearch}
                  disabled={saving}
                />
                전적 검색 허용
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  name="shareHistory"
                  type="checkbox"
                  defaultChecked={member.shareHistory}
                  disabled={saving}
                />
                내 경기 히스토리 공개
              </label>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "저장 중..." : "내 설정 저장"}
              </Button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}
