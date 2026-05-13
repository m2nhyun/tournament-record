"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import type { LucideProps } from "lucide-react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ClubRecordTimeSelectProps = {
  id: string;
  value: string;
  options: string[];
  onValueChange: (value: string) => void;
  icon: ComponentType<LucideProps>;
  disabled?: boolean;
};

export function ClubRecordTimeSelect({
  id,
  value,
  options,
  onValueChange,
  icon: Icon,
  disabled,
}: ClubRecordTimeSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-11 w-full justify-between rounded-xl bg-muted/20 px-3 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span>{value}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div
          role="listbox"
          aria-label="시간 선택"
          className="grid max-h-72 grid-cols-3 gap-1 overflow-y-auto"
        >
          {options.map((option) => (
            <Button
              key={option}
              type="button"
              variant={option === value ? "secondary" : "outline"}
              size="sm"
              role="option"
              aria-selected={option === value}
              className={
                option === value
                  ? "justify-center rounded-lg"
                  : "justify-center rounded-lg border-transparent bg-transparent"
              }
              onClick={() => {
                onValueChange(option);
                setOpen(false);
              }}
            >
              {option}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
