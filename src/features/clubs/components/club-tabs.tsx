import { LayoutGrid, Plus, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { ClubTab } from "@/features/clubs/types/club";

type ClubTabsProps = {
  activeTab: ClubTab;
  onChange: (tab: ClubTab) => void;
  canCreateClub?: boolean;
};

const tabs: Array<{ key: ClubTab; label: string; icon: typeof LayoutGrid }> = [
  { key: "list", label: "내 클럽", icon: LayoutGrid },
  { key: "join", label: "참가하기", icon: UserPlus },
  { key: "create", label: "클럽 만들기", icon: Plus },
];

export function ClubTabs({
  activeTab,
  onChange,
  canCreateClub = true,
}: ClubTabsProps) {
  const visibleTabs = canCreateClub
    ? tabs
    : tabs.filter((tab) => tab.key !== "create");

  return (
    <div
      className={cn(
        "grid gap-2 rounded-xl bg-muted p-1",
        visibleTabs.length === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative flex min-h-[44px] flex-col items-center justify-center rounded-lg px-2 py-2 transition-colors active:opacity-95",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="club-tab-active-bg"
                className="absolute inset-0 rounded-lg bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon className="relative mb-1 size-4" />
            <span className="relative text-xs font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
