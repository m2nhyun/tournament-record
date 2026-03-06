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
    <div className={cn("flex min-h-[calc(100dvh-9rem)] items-center justify-center", className)}>
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--brand)]" />
        {title ? <p className="mt-3 text-base font-semibold">{title}</p> : null}
        {message ? (
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
