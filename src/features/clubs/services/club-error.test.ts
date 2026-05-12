import { describe, expect, it } from "vitest";

import { mapClubSettingsError, toClubErrorMessage } from "./club-error";

describe("mapClubSettingsError", () => {
  it("클럽명 중복 unique 에러를 사용자 문구로 변환한다", () => {
    const mapped = mapClubSettingsError({
      message: 'duplicate key value violates unique constraint "idx_clubs_name_normalized_unique"',
    });
    expect(mapped.message).toBe("이미 사용 중인 클럽 이름입니다.");
  });

  it("초대코드 재발급 권한 에러를 사용자 문구로 변환한다", () => {
    const mapped = mapClubSettingsError({
      message: "Only owner can regenerate invite code",
    });
    expect(mapped.message).toBe("클럽장만 초대 코드를 재발급할 수 있습니다.");
  });

  it("알 수 없는 에러는 기본 메시지로 처리한다", () => {
    const mapped = mapClubSettingsError({ code: "X" });
    expect(mapped.message).toBe("설정 변경 중 오류가 발생했습니다.");
  });
});

describe("toClubErrorMessage", () => {
  it("UUID 형식이 아닌 클럽 주소를 사용자 문구로 변환한다", () => {
    const message = toClubErrorMessage({
      message: 'invalid input syntax for type uuid: "test-club"',
    });

    expect(message).toBe(
      "클럽 주소가 올바르지 않습니다. 내 클럽 목록에서 다시 진입해주세요.",
    );
  });

  it("plain object PostgREST 메시지도 버리지 않는다", () => {
    const message = toClubErrorMessage({
      message: "custom database message",
    });

    expect(message).toBe("custom database message");
  });
});
