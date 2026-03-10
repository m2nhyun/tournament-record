import { Badge } from "@/components/ui/badge";
import type { MatchStatus } from "@/features/matches/types/match";

const statusConfig: Record<
  MatchStatus,
  {
    label: string;
    variant: "default" | "brand" | "success" | "warning" | "destructive";
  }
> = {
  draft: { label: "임시저장", variant: "default" },
  submitted: { label: "상대 확인 대기", variant: "warning" },
  confirmed: { label: "확정", variant: "success" },
  disputed: { label: "확인 거절", variant: "destructive" },
};

type MatchStatusBadgeProps = {
  status: MatchStatus;
};

export function MatchStatusBadge({ status }: MatchStatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
