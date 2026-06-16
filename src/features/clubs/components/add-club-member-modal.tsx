"use client";

import { FormEvent } from "react";
import { Loader2, UserPlus } from "lucide-react";

import { Modal } from "@/components/common/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddClubMemberModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onAdd: (nickname: string) => Promise<void>;
};

export function AddClubMemberModal({
  open,
  onOpenChange,
  saving,
  onAdd,
}: AddClubMemberModalProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("nickname") ?? "").trim();
    if (nickname.length < 2 || nickname.length > 24) return;

    await onAdd(nickname);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="멤버 추가"
      description="로그인하지 않은 클럽 인원을 이름으로 먼저 추가합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="member-nickname">이름</Label>
          <Input
            id="member-nickname"
            name="nickname"
            placeholder="클럽에서 부르는 이름"
            minLength={2}
            maxLength={24}
            required
          />
          <p className="text-xs text-muted-foreground">
            같은 이름으로 초대 링크에 들어오면 이 멤버와 계정을 연결할 수 있습니다.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              추가 중...
            </>
          ) : (
            <>
              <UserPlus className="size-4" />
              멤버 추가
            </>
          )}
        </Button>
      </form>
    </Modal>
  );
}
