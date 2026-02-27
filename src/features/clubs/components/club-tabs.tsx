import { LayoutGrid, Plus, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClubTab } from "@/features/clubs/types/club";

type ClubTabsProps = {
  activeTab: ClubTab;
  onChange: (tab: ClubTab) => void;
};

const tabs: Array<{ key: ClubTab; label: string; icon: typeof LayoutGrid }> = [
  { key: "list", label: "내 클럽", icon: LayoutGrid },
  { key: "join", label: "참가하기", icon: UserPlus },
  { key: "create", label: "클럽 만들기", icon: Plus },
];

export function ClubTabs({ activeTab, onChange }: ClubTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center rounded-lg px-2 py-2 transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Icon className="mb-1 size-4" />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
