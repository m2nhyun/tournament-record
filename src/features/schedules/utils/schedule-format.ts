import type {
  MatchScheduleFormat,
  MatchScheduleStatus,
} from "@/features/schedules/types/schedule";

export const scheduleFormatLabels: Record<MatchScheduleFormat, string> = {
  men_doubles: "남복",
  women_doubles: "여복",
  open_doubles: "성별무관",
};

export const scheduleStatusLabels: Record<MatchScheduleStatus, string> = {
  open: "모집중",
  full: "마감",
  cancelled: "취소됨",
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
