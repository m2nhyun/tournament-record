function extractMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message ?? "";
  }
  return "";
}

function mapCommonClubMessage(message: string) {
  if (message.includes("invalid input syntax for type uuid")) {
    return "클럽 주소가 올바르지 않습니다. 내 클럽 목록에서 다시 진입해주세요.";
  }

  if (
    message.includes("JSON object requested, multiple (or no) rows returned") ||
    message.includes("cannot coerce the result to a single json object") ||
    message.includes("PGRST116")
  ) {
    return "클럽을 찾을 수 없거나 접근 권한이 없습니다. 초대 코드와 로그인 상태를 다시 확인해주세요.";
  }

  return null;
}

export function toClubErrorMessage(error: unknown) {
  const message = extractMessage(error);
  const commonMessage = mapCommonClubMessage(message);

  if (commonMessage) return commonMessage;
  if (error instanceof Error) return error.message;
  if (message) return message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function mapClubSettingsError(error: unknown): Error {
  const message = extractMessage(error);
  const commonMessage = mapCommonClubMessage(message);

  if (commonMessage) {
    return new Error(commonMessage);
  }

  if (
    message.includes("idx_clubs_name_normalized_unique") ||
    message.includes("clubs_name_normalized_unique")
  ) {
    return new Error("이미 사용 중인 클럽 이름입니다.");
  }

  if (
    message.includes("idx_club_members_nickname_normalized_unique") ||
    message.includes("club_members_nickname_normalized_unique")
  ) {
    return new Error("클럽 내 중복된 닉네임입니다.");
  }

  if (message.includes("Only owner can update club name")) {
    return new Error("클럽장만 클럽 이름을 변경할 수 있습니다.");
  }

  if (message.includes("Only owner can regenerate invite code")) {
    return new Error("클럽장만 초대 코드를 재발급할 수 있습니다.");
  }

  if (message.includes("Not a club member")) {
    return new Error("클럽 멤버만 닉네임을 변경할 수 있습니다.");
  }

  if (message.includes("Only owner can remove member")) {
    return new Error("클럽장만 멤버를 내보낼 수 있습니다.");
  }

  if (message.includes("클럽 운영진만 멤버를 추가할 수 있습니다.")) {
    return new Error("클럽 운영진만 멤버를 추가할 수 있습니다.");
  }

  if (message.includes("계정 연결 전에는 운영진으로 지정할 수 없습니다.")) {
    return new Error("계정 연결 전에는 운영진으로 지정할 수 없습니다.");
  }

  if (message.includes("Owner cannot be removed")) {
    return new Error("방장은 내보낼 수 없습니다.");
  }

  if (message.includes("Cannot remove yourself")) {
    return new Error("본인은 내보낼 수 없습니다.");
  }

  if (message.includes("Member not found")) {
    return new Error("이미 클럽에서 제외된 멤버입니다.");
  }

  if (message.includes("violates check constraint")) {
    return new Error("이름/닉네임은 2~24자로 입력해주세요.");
  }

  if (error instanceof Error) return error;
  return new Error("설정 변경 중 오류가 발생했습니다.");
}
