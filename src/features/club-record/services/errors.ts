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

  if (
    message.includes("Could not find the function") ||
    message.includes("function") && message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("PGRST202")
  ) {
    return "최신 DB 업데이트가 아직 반영되지 않았습니다. 운영진에게 알려주세요.";
  }

  if (
    message.includes("permission denied") ||
    message.includes("권한이 없")
  ) {
    return "이 작업을 수행할 권한이 없습니다.";
  }

  return null;
}

export function toClubRecordErrorMessage(error: unknown) {
  const message = extractMessage(error);
  const commonMessage = mapCommonClubRecordMessage(message);

  if (commonMessage) return commonMessage;
  if (error instanceof Error) return error.message;
  if (message) return message;
  return "데일리 매치 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
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
  return new Error(
    "데일리 매치 처리 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  );
}
