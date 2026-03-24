import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";

type AppShellProps = {
  children: ReactNode;
  clubId?: string;
};

export function AppShell({ children, clubId }: AppShellProps) {
  return (
    <div className="fixed inset-0 bg-background">
      <main
        className="mx-auto h-full w-full max-w-3xl overscroll-contain pb-24"
        style={{ overflowY: "auto" }}
      >
        {children}
      </main>
      <BottomNav clubId={clubId} />
    </div>
  );
}
