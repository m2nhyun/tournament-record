import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 text-center">
      <Icon className="mx-auto mb-3 size-10 text-muted-foreground/40" />
      <p className="mb-1 text-sm font-medium text-muted-foreground">{title}</p>
      {description ? (
        <p className="mb-4 text-xs text-muted-foreground/70">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
