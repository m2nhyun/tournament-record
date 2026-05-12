import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { ensureSessionUser, getCurrentUser } from "./auth";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("auth service request coalescing", () => {
  it("shares concurrent current-user requests", async () => {
    const user = { id: "user-1", is_anonymous: false };
    const session = createDeferred<{
      data: { session: { access_token: string } };
      error: null;
    }>();
    const getSession = vi.fn(() => session.promise);
    const getUser = vi.fn(async () => ({
      data: { user },
      error: null,
    }));

    mocks.getSupabaseClient.mockReturnValue({
      auth: { getSession, getUser },
    });

    const first = getCurrentUser();
    const second = getCurrentUser();

    expect(getSession).toHaveBeenCalledTimes(1);

    session.resolve({
      data: { session: { access_token: "token" } },
      error: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([user, user]);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("shares concurrent session-user requests", async () => {
    const session = createDeferred<{
      data: { session: null };
      error: null;
    }>();
    const getSession = vi.fn(() => session.promise);
    const getUser = vi.fn();
    const signInAnonymously = vi.fn();

    mocks.getSupabaseClient.mockReturnValue({
      auth: { getSession, getUser, signInAnonymously },
    });

    const first = ensureSessionUser();
    const second = ensureSessionUser();

    expect(getSession).toHaveBeenCalledTimes(1);

    session.resolve({
      data: { session: null },
      error: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);
    expect(getUser).not.toHaveBeenCalled();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
