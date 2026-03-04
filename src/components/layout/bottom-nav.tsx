"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, PlusCircle, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

type BottomNavProps = {
  clubId?: string;
};

type NavItem = {
  icon: typeof Home;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

function buildNavItems(clubId?: string): NavItem[] {
  if (!clubId) {
    return [
      {
        icon: Home,
        label: "홈",
        href: "/",
        match: (p) => p === "/",
      },
    ];
  }

  const base = `/clubs/${clubId}`;

  return [
    {
      icon: Home,
      label: "홈",
      href: base,
      match: (p) => p === base,
    },
    {
      icon: PlusCircle,
      label: "새 경기",
      href: `${base}/matches/new`,
      match: (p) => p === `${base}/matches/new`,
    },
    {
      icon: History,
      label: "히스토리",
      href: `${base}/history`,
      match: (p) => p === `${base}/history`,
    },
    {
      icon: Trophy,
      label: "리더보드",
      href: `${base}/leaderboard`,
      match: (p) => p === `${base}/leaderboard`,
    },
  ];
}

export function BottomNav({ clubId }: BottomNavProps) {
  const pathname = usePathname();
  const items = buildNavItems(clubId);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-around px-4">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1",
                active ? "text-[var(--brand)]" : "text-muted-foreground",
              )}
              aria-label={item.label}
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
