export function createNotImplementedError(feature: string) {
  return new Error(`${feature} 구현이 아직 연결되지 않았습니다.`);
}

function extractMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

function mapCommonClubRecordMessage(message: string) {
  if (message.includes("invalid input syntax for type uuid")) {
    return "클럽 주소가 올바르지 않습니다. 내 클럽 목록에서 다시 진입해주세요.";
  }

  if (
    message.includes("JSON object requested, multiple (or no) rows returned") ||
    message.includes("PGRST116")
  ) {
    return "클럽을 찾을 수 없거나 접근 권한이 없습니다.";
  }

  return null;
}

export function toClubRecordErrorMessage(error: unknown) {
  const message = extractMessage(error);
  const commonMessage = mapCommonClubRecordMessage(message);

  if (commonMessage) return commonMessage;
  if (error instanceof Error) return error.message;
  if (message) return message;
  return "club record 요청 처리 중 오류가 발생했습니다.";
}

export function mapClubRecordError(error: unknown): Error {
  const message = extractMessage(error);
  const commonMessage = mapCommonClubRecordMessage(message);

  if (commonMessage) {
    return new Error(commonMessage);
  }

  if (message.includes("Not authenticated")) {
    return new Error("로그인이 필요합니다.");
  }

  if (message.includes("violates check constraint")) {
    return new Error("입력값 형식이 올바르지 않습니다.");
  }

  if (error instanceof Error) return error;
  return new Error("club record 처리 중 오류가 발생했습니다.");
}
