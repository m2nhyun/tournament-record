import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusType = "success" | "error" | "info";

type StatusBoxProps = {
  type: StatusType;
  message: string;
};

export function StatusBox({ type, message }: StatusBoxProps) {
  if (!message) return null;

  const icon =
    type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        type === "error" && "border-rose-200 bg-rose-50 text-rose-700",
        type === "info" && "border-border bg-background text-muted-foreground"
      )}
    >
      {icon}
      <p>{message}</p>
    </div>
  );
}
