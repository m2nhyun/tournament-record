import { describe, expect, it } from "vitest";

import { mapClubRecordError, toClubRecordErrorMessage } from "./errors";

describe("toClubRecordErrorMessage", () => {
  it("UUID 형식이 아닌 클럽 주소를 사용자 문구로 변환한다", () => {
    const message = toClubRecordErrorMessage({
      message: 'invalid input syntax for type uuid: "test-club"',
    });

    expect(message).toBe(
      "클럽 주소가 올바르지 않습니다. 내 클럽 목록에서 다시 진입해주세요.",
    );
  });

  it("plain object PostgREST 메시지도 표시한다", () => {
    const message = toClubRecordErrorMessage({
      message: "custom club record message",
    });

    expect(message).toBe("custom club record message");
  });
});

describe("mapClubRecordError", () => {
  it("UUID 형식 에러를 Error 객체로 변환한다", () => {
    const mapped = mapClubRecordError({
      message: 'invalid input syntax for type uuid: "test-club"',
    });

    expect(mapped.message).toBe(
      "클럽 주소가 올바르지 않습니다. 내 클럽 목록에서 다시 진입해주세요.",
    );
  });
});
