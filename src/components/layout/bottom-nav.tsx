"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, Home, Users } from "lucide-react";

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
  const clubRecordBase = `${base}/club-record`;
  const clubRecordEventList = new Set([
    `${clubRecordBase}/events`,
    `${clubRecordBase}/new`,
    `${clubRecordBase}/history`,
    `${clubRecordBase}/monthly`,
    `${clubRecordBase}/ranking`,
  ]);

  return [
    {
      icon: Home,
      label: "홈",
      href: base,
      match: (p) =>
        p === base ||
        p === clubRecordBase ||
        p === `${clubRecordBase}/monthly` ||
        p === `${clubRecordBase}/ranking`,
    },
    {
      icon: CalendarDays,
      label: "이벤트",
      href: `${clubRecordBase}/events`,
      match: (p) =>
        p === `${clubRecordBase}/events` ||
        p === `${clubRecordBase}/new` ||
        (p.startsWith(`${clubRecordBase}/`) && !clubRecordEventList.has(p)),
    },
    {
      icon: History,
      label: "히스토리",
      href: `${clubRecordBase}/history`,
      match: (p) => p === `${clubRecordBase}/history`,
    },
    {
      icon: Users,
      label: "클럽",
      href: `${base}/club`,
      match: (p) => p === `${base}/club`,
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
                "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-md active:opacity-95",
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
