import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";

type AppShellProps = {
  children: ReactNode;
  clubId?: string;
};

export function AppShell({ children, clubId }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-3xl pb-24">{children}</main>
      <BottomNav clubId={clubId} />
    </div>
  );
}
