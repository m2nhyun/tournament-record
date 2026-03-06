"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type AppBarProps = {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  actions?: ReactNode;
  bottomBorder?: boolean;
  className?: string;
};

export function AppBar({
  title,
  onBack,
  showBack = true,
  actions,
  bottomBorder = true,
  className,
}: AppBarProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex min-h-14 items-center justify-center bg-background/95 px-2 backdrop-blur-sm",
        bottomBorder ? "border-b" : "",
        className,
      )}
    >
      <div className="absolute left-1 flex h-full items-center justify-start">
        {showBack ? (
          <button
            type="button"
            onClick={() => {
              if (onBack) onBack();
              else router.back();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-md active:opacity-95"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}
      </div>

      <span className="max-w-[calc(100%-120px)] truncate text-center text-sm font-semibold">
        {title ?? ""}
      </span>

      <div className="absolute right-1 flex h-full min-w-14 items-center justify-end">
        {actions}
      </div>
    </div>
  );
}
