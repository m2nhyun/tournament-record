import type {
  MatchScheduleFormat,
  MatchScheduleJoinPolicy,
  MatchScheduleRequestStatus,
  MatchScheduleStatus,
} from "@/features/schedules/types/schedule";

export const scheduleFormatLabels: Record<MatchScheduleFormat, string> = {
  men_doubles: "남복",
  women_doubles: "여복",
  open_doubles: "성별무관",
};

export const scheduleStatusLabels: Record<MatchScheduleStatus, string> = {
  open: "모집중",
  reviewing: "승인 대기",
  full: "마감",
  cancelled: "취소됨",
};

export const scheduleJoinPolicyLabels: Record<MatchScheduleJoinPolicy, string> = {
  instant: "바로 참가",
  approval_required: "승인 후 참가",
};

export const scheduleRequestStatusLabels: Record<
  MatchScheduleRequestStatus,
  string
> = {
  pending: "신청 대기",
  accepted: "수락됨",
  rejected: "거절됨",
  cancelled_by_user: "신청 취소",
};

export function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function formatScheduleDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatScheduleDateTimeRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(startDate);
  const timeLabel = new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel} ${timeLabel.format(startDate)} ~ ${timeLabel.format(endDate)}`;
}
