import { FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JoinClubFormProps = {
  inviteCode: string;
  nickname: string;
  isSubmitting: boolean;
  onChangeInviteCode: (value: string) => void;
  onChangeNickname: (value: string) => void;
  onSubmit: () => Promise<void>;
};

export function JoinClubForm({
  inviteCode,
  nickname,
  isSubmitting,
  onChangeInviteCode,
  onChangeNickname,
  onSubmit,
}: JoinClubFormProps) {
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">클럽 참가</h2>
        <p className="text-sm text-muted-foreground">전달받은 초대 코드를 입력해 주세요.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="invite-code">초대 코드</Label>
          <Input
            id="invite-code"
            value={inviteCode}
            onChange={(event) => onChangeInviteCode(event.target.value.toUpperCase())}
            placeholder="예: 7KD2QP"
            maxLength={6}
            autoCapitalize="characters"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="join-nickname">활동 닉네임</Label>
          <Input
            id="join-nickname"
            value={nickname}
            onChange={(event) => onChangeNickname(event.target.value)}
            placeholder="클럽에서 사용할 이름"
            maxLength={20}
          />
        </div>
      </div>

      <Button className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            처리 중...
          </span>
        ) : (
          "참가 완료"
        )}
      </Button>
    </form>
  );
}
