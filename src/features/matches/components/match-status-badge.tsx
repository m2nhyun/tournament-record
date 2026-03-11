import { Badge } from "@/components/ui/badge";
import type { MatchStatus } from "@/features/matches/types/match";
import { getMatchStatusCopy } from "@/features/matches/utils/match-status";

type MatchStatusBadgeProps = {
  status: MatchStatus;
};

export function MatchStatusBadge({ status }: MatchStatusBadgeProps) {
  const config = getMatchStatusCopy(status);
  return <Badge variant={config.badgeVariant}>{config.badgeLabel}</Badge>;
}
