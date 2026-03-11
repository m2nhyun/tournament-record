import type {
  MatchConfirmation,
  MatchStatus,
} from "@/features/matches/types/match";

type MatchStatusCopy = {
  badgeLabel: string;
  badgeVariant: "default" | "brand" | "success" | "warning" | "destructive";
  historyLabel: string;
};

const statusCopy: Record<MatchStatus, MatchStatusCopy> = {
  draft: {
    badgeLabel: "임시저장",
    badgeVariant: "default",
    historyLabel: "기록 전",
  },
  submitted: {
    badgeLabel: "기록됨",
    badgeVariant: "warning",
    historyLabel: "기록됨",
  },
  confirmed: {
    badgeLabel: "확정",
    badgeVariant: "success",
    historyLabel: "확정",
  },
  disputed: {
    badgeLabel: "재검토 필요",
    badgeVariant: "destructive",
    historyLabel: "재검토",
  },
};

export function getMatchStatusCopy(status: MatchStatus) {
  return statusCopy[status];
}

export function resolveMatchStatus(
  status: MatchStatus,
  confirmations: Pick<MatchConfirmation, "decision">[],
) {
  if (confirmations.length === 0) return status;
  if (confirmations.some((confirmation) => confirmation.decision === "rejected")) {
    return "disputed" as const;
  }
  if (confirmations.every((confirmation) => confirmation.decision === "approved")) {
    return "confirmed" as const;
  }
  return "submitted" as const;
}

export function getPendingConfirmationNames(confirmations: MatchConfirmation[]) {
  return confirmations
    .filter((confirmation) => confirmation.decision === "pending")
    .map((confirmation) => confirmation.nickname);
}

export function getRejectedConfirmationNames(confirmations: MatchConfirmation[]) {
  return confirmations
    .filter((confirmation) => confirmation.decision === "rejected")
    .map((confirmation) => confirmation.nickname);
}
