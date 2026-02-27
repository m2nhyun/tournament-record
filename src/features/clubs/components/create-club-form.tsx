import { FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateClubFormProps = {
  name: string;
  nickname: string;
  isSubmitting: boolean;
  onChangeName: (value: string) => void;
  onChangeNickname: (value: string) => void;
  onSubmit: () => Promise<void>;
};

export function CreateClubForm({
  name,
  nickname,
  isSubmitting,
  onChangeName,
  onChangeNickname,
  onSubmit,
}: CreateClubFormProps) {
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">새 클럽 만들기</h2>
        <p className="text-sm text-muted-foreground">운영할 모임을 만들고 초대 코드를 공유하세요.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="create-club-name">클럽 이름</Label>
          <Input
            id="create-club-name"
            value={name}
            onChange={(event) => onChangeName(event.target.value)}
            placeholder="예: 일요 테니스회"
            maxLength={40}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="create-club-nickname">내 닉네임</Label>
          <Input
            id="create-club-nickname"
            value={nickname}
            onChange={(event) => onChangeNickname(event.target.value)}
            placeholder="예: 민현"
            maxLength={20}
          />
        </div>

      </div>

      <Button className="w-full bg-[var(--brand)] text-[var(--brand-foreground)]" disabled={isSubmitting}>
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            생성 중...
          </span>
        ) : (
          "클럽 만들기"
        )}
      </Button>
    </form>
  );
}
