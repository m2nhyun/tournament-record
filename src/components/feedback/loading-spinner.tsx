import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingSpinnerProps = {
  className?: string;
  title?: string;
  message?: string;
};

export function LoadingSpinner({
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex min-h-[calc(100dvh-9rem)] items-center justify-center", className)}>
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--brand)]" />
      </div>
    </div>
  );
}
