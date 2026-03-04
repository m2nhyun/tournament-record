import { User, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MatchType } from "@/features/matches/types/match";

type MatchTypeSelectorProps = {
  matchType: MatchType;
  playedAt: string;
  canUseDoubles: boolean;
  onChangeType: (type: MatchType) => void;
  onChangeDate: (date: string) => void;
};

const options: {
  value: MatchType;
  label: string;
  icon: typeof User;
  desc: string;
}[] = [
  { value: "singles", label: "단식", icon: User, desc: "1 vs 1" },
  { value: "doubles", label: "복식", icon: Users, desc: "2 vs 2" },
];

export function MatchTypeSelector({
  matchType,
  playedAt,
  canUseDoubles,
  onChangeType,
  onChangeDate,
}: MatchTypeSelectorProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>경기 유형</Label>
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => {
            const active = matchType === opt.value;
            const disabled = opt.value === "doubles" && !canUseDoubles;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onChangeType(opt.value)}
                className={cn(
                  "flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 transition-colors",
                  active
                    ? "border-[var(--brand)] bg-[var(--brand)]/5 text-[var(--brand)]"
                    : "border-border hover:bg-accent/50",
                  disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                <opt.icon className="size-6" />
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {disabled ? "멤버 4명 필요" : opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="played-at">경기 날짜</Label>
        <Input
          id="played-at"
          type="date"
          value={playedAt}
          onChange={(e) => onChangeDate(e.target.value)}
        />
      </div>
    </div>
  );
}
