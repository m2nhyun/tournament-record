import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // text-base on mobile (>= 16px) prevents iOS Safari/Chrome from
        // auto-zooming on focus; sm:text-sm keeps the desktop visual.
        "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base shadow-xs outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
