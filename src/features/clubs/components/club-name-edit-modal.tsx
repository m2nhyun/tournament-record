import { FormEvent } from "react";

import { Modal } from "@/components/common/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClubNameEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  currentName: string;
  onSave: (name: string) => Promise<void>;
};

export function ClubNameEditModal({
  open,
  onOpenChange,
  saving,
  currentName,
  onSave,
}: ClubNameEditModalProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("clubName") ?? "").trim();
    if (name.length < 2 || name === currentName) return;
    await onSave(name);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="클럽 이름 변경">
      <form
        key={`club-name-dialog-${currentName}`}
        onSubmit={(e) => void submit(e)}
        className="space-y-3"
      >
        <Input
          name="clubName"
          defaultValue={currentName}
          minLength={2}
          maxLength={24}
          placeholder="클럽 이름"
          disabled={saving}
        />
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
