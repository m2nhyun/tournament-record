import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("Supabase row id 형식의 UUID를 허용한다", () => {
    expect(isUuid("7e5d7429-be8c-43a4-8149-65e7e9e52a9b")).toBe(true);
  });

  it("slug나 임의 문자열은 거부한다", () => {
    expect(isUuid("test-club")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
