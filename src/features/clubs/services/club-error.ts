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

export function mapClubSettingsError(error: unknown): Error {
  const message = extractMessage(error);

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

