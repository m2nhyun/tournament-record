import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingSpinnerProps = {
  className?: string;
  title?: string;
  message?: string;
};

export function LoadingSpinner({
  className,
  title,
  message,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100dvh-9rem)] items-center justify-center px-6",
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="size-8 animate-spin text-[var(--brand)]" />
        {title ? (
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        ) : null}
        {message ? (
          <p className="text-xs text-muted-foreground/70">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
