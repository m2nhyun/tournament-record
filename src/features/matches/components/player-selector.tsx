import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClubMember } from "@/features/clubs/types/club";

type PlayerSelectorProps = {
  members: ClubMember[];
  side1Ids: string[];
  side2Ids: string[];
  requiredPerSide: number;
  onToggle: (memberId: string, side: 1 | 2) => void;
};

export function PlayerSelector({
  members,
  side1Ids,
  side2Ids,
  requiredPerSide,
  onToggle,
}: PlayerSelectorProps) {
  return (
    <div className="space-y-5">
      <SideSection
        title={`사이드 1 (${side1Ids.length}/${requiredPerSide})`}
        side={1}
        selectedIds={side1Ids}
        otherIds={side2Ids}
        members={members}
        onToggle={onToggle}
      />
      <SideSection
        title={`사이드 2 (${side2Ids.length}/${requiredPerSide})`}
        side={2}
        selectedIds={side2Ids}
        otherIds={side1Ids}
        members={members}
        onToggle={onToggle}
      />
    </div>
  );
}

type SideSectionProps = {
  title: string;
  side: 1 | 2;
  selectedIds: string[];
  otherIds: string[];
  members: ClubMember[];
  onToggle: (memberId: string, side: 1 | 2) => void;
};

function SideSection({
  title,
  side,
  selectedIds,
  otherIds,
  members,
  onToggle,
}: SideSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-2">
        {members.map((member) => {
          const isSelected = selectedIds.includes(member.id);
          const isOther = otherIds.includes(member.id);

          return (
            <button
              key={member.id}
              type="button"
              disabled={isOther}
              onClick={() => onToggle(member.id, side)}
              className={cn(
                "flex min-h-[44px] items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected && "border-[var(--brand)] bg-[var(--brand)]/5",
                isOther && "cursor-not-allowed opacity-40",
                !isSelected && !isOther && "hover:bg-accent/50",
              )}
            >
              <span className="text-sm font-medium">{member.nickname}</span>
              {isSelected ? (
                <Check className="size-4 text-[var(--brand)]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
