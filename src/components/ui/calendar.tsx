"use client";

import { ko } from "react-day-picker/locale";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      locale={ko}
      showOutsideDays
      className={cn("rounded-2xl border bg-background p-3 shadow-sm", className)}
      classNames={{
        root: cn("w-full", defaultClassNames.root),
        months: "w-full",
        month: "w-full space-y-4",
        month_caption:
          "flex items-center justify-center pt-1 text-sm font-semibold text-foreground",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-3 top-3 inline-flex size-8 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted",
        button_next:
          "absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted",
        month_grid: "mt-4 w-full border-collapse",
        weekdays: "grid grid-cols-7 gap-1",
        weekday:
          "flex h-8 items-center justify-center text-[11px] font-medium text-muted-foreground",
        week: "mt-1 grid grid-cols-7 gap-1",
        day: "h-11 w-full p-0",
        day_button:
          "flex size-11 items-center justify-center rounded-2xl text-sm font-medium transition-colors hover:bg-muted aria-selected:bg-[var(--brand)] aria-selected:text-white aria-selected:shadow-md aria-selected:ring-2 aria-selected:ring-[var(--brand)]/30",
        today: "text-[var(--brand)]",
        selected: "bg-transparent",
        outside: "text-muted-foreground/40",
        disabled: "text-muted-foreground/30",
        ...classNames,
      }}
      {...props}
    />
  );
}
