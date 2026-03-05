import { FormEvent } from "react";

import { Modal } from "@/components/common/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClubMember } from "@/features/clubs/types/club";

type MyMemberSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  member: ClubMember;
  onSave: (input: {
    nickname: string;
    openKakaoProfile: boolean;
    allowRecordSearch: boolean;
    shareHistory: boolean;
  }) => Promise<void>;
};

export function MyMemberSettingsModal({
  open,
  onOpenChange,
  saving,
  member,
  onSave,
}: MyMemberSettingsModalProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("myNickname") ?? "").trim();
    if (nickname.length < 2 || nickname.length > 24) return;

    await onSave({
      nickname,
      openKakaoProfile: formData.get("openKakaoProfile") === "on",
      allowRecordSearch: formData.get("allowRecordSearch") === "on",
      shareHistory: formData.get("shareHistory") === "on",
    });
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="내 설정">
      <form
        key={`my-settings-${member.id}-${member.nickname}-${member.openKakaoProfile}-${member.allowRecordSearch}-${member.shareHistory}`}
        onSubmit={(e) => void submit(e)}
        className="space-y-3"
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
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
