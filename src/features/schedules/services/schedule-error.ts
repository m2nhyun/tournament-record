type ErrorLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function readMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ErrorLike).message;
    if (typeof message === "string") return message;
  }
  return null;
}

export function mapScheduleError(error: unknown): Error {
  const message = readMessage(error);

  if (!message) {
    return new Error("요청 처리 중 오류가 발생했습니다.");
  }

  if (
    message.includes("Could not find the function public.create_match_schedule") ||
    message.includes("Could not find the function public.request_match_schedule") ||
    message.includes("relation \"public.match_schedules\" does not exist") ||
    message.includes("relation \"match_schedules\" does not exist") ||
    message.includes("relation \"public.match_schedule_requests\" does not exist") ||
    message.includes("relation \"match_schedule_requests\" does not exist") ||
    message.includes("column match_schedules.join_policy does not exist")
  ) {
    return new Error(
      "일정/매칭 스키마가 아직 반영되지 않았습니다. 최신 Supabase 마이그레이션을 먼저 실행해주세요.",
    );
  }

  if (message.includes("Not authenticated")) {
    return new Error("로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.");
  }

  return new Error(message);
}
