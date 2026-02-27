import type { ReactNode } from "react";
import { History, Home, PlusCircle, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-[var(--brand)]" />
            <span className="text-lg font-semibold tracking-tight">Tournament Record</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-around px-4">
          <BottomNavItem active icon={Home} label="홈" />
          <BottomNavItem icon={PlusCircle} label="새 경기" />
          <BottomNavItem icon={History} label="히스토리" />
        </div>
      </nav>
    </div>
  );
}

type BottomNavItemProps = {
  icon: typeof Home;
  label: string;
  active?: boolean;
};

function BottomNavItem({ icon: Icon, label, active = false }: BottomNavItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1",
        active ? "text-[var(--brand)]" : "text-muted-foreground"
      )}
      aria-label={label}
    >
      <Icon className="size-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
