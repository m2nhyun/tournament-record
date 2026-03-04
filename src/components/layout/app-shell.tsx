import type { ReactNode } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

import { BottomNav } from "@/components/layout/bottom-nav";

type AppShellProps = {
  children: ReactNode;
  clubId?: string;
};

export function AppShell({ children, clubId }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-4">
          <Link
            href={clubId ? `/clubs/${clubId}` : "/"}
            className="flex items-center gap-2"
          >
            <Trophy className="size-5 text-[var(--brand)]" />
            <span className="text-lg font-semibold tracking-tight">
              Tournament Record
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24">
        {children}
      </main>

      <BottomNav clubId={clubId} />
    </div>
  );
}
