import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

vi.mock("@/features/auth/services/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

import {
  getMyProfile,
  isProfileComplete,
  requireCompletedProfile,
} from "./profile";

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  gender: "male" | "female" | "unspecified" | null;
  profile_completed: boolean;
  auth_provider: string | null;
};

function mockSelectSingle(result: {
  data: UserProfileRow | null;
  error: { code?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  mocks.getSupabaseClient.mockReturnValue({ from });
  return { from, select, eq, single };
}

beforeEach(() => {
  mocks.getSupabaseClient.mockReset();
  mocks.getCurrentUser.mockReset();
});

describe("requireCompletedProfile", () => {
  it("throws when logged out", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(requireCompletedProfile()).rejects.toThrow(
      "정회원 로그인 후 이용해주세요.",
    );
  });

  it("throws when user is anonymous (guest session)", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "anon-1",
      is_anonymous: true,
    });

    await expect(requireCompletedProfile()).rejects.toThrow(
      "정회원 로그인 후 이용해주세요.",
    );
  });

  it("throws when user_profiles row does not exist", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({ data: null, error: { code: "PGRST116" } });

    await expect(requireCompletedProfile()).rejects.toThrow(
      "기본 프로필을 먼저 완료해주세요. 활동 이름과 성별을 저장하면 계속할 수 있습니다.",
    );
  });

  it("throws when profile_completed is false", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({
      data: {
        user_id: "user-1",
        display_name: null,
        gender: null,
        profile_completed: false,
        auth_provider: "email",
      },
      error: null,
    });

    await expect(requireCompletedProfile()).rejects.toThrow(
      "기본 프로필을 먼저 완료해주세요.",
    );
  });

  it("returns mapped profile when profile_completed is true", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({
      data: {
        user_id: "user-1",
        display_name: "민현",
        gender: "male",
        profile_completed: true,
        auth_provider: "kakao",
      },
      error: null,
    });

    const profile = await requireCompletedProfile();

    expect(profile).toEqual({
      userId: "user-1",
      displayName: "민현",
      gender: "male",
      profileCompleted: true,
      authProvider: "kakao",
    });
  });

  it("propagates non-PGRST116 select errors", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({
      data: null,
      error: { code: "42501" },
    });

    await expect(requireCompletedProfile()).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("getMyProfile", () => {
  it("returns null for logged-out callers", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(getMyProfile()).resolves.toBeNull();
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns null for anonymous sessions without hitting DB", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "anon-1",
      is_anonymous: true,
    });

    await expect(getMyProfile()).resolves.toBeNull();
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns null when row is missing (PGRST116)", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({ data: null, error: { code: "PGRST116" } });

    await expect(getMyProfile()).resolves.toBeNull();
  });
});

describe("isProfileComplete", () => {
  it("returns false when profile is missing", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({ data: null, error: { code: "PGRST116" } });

    await expect(isProfileComplete()).resolves.toBe(false);
  });

  it("returns true when profile_completed is true", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    });
    mockSelectSingle({
      data: {
        user_id: "user-1",
        display_name: "민현",
        gender: "unspecified",
        profile_completed: true,
        auth_provider: "email",
      },
      error: null,
    });

    await expect(isProfileComplete()).resolves.toBe(true);
  });
});
