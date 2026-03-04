import { getSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export const isGuestModeEnabled =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_ALLOW_GUEST_MODE === "true";

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (
    sessionError &&
    !sessionError.message.toLowerCase().includes("auth session missing")
  ) {
    throw sessionError;
  }

  if (!session?.access_token) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (
    userError &&
    !userError.message.toLowerCase().includes("auth session missing")
  ) {
    throw userError;
  }

  return user ?? null;
}

export async function ensureSessionUser(): Promise<User | null> {
  const existingUser = await getCurrentUser();
  if (existingUser) return existingUser;

  if (!isGuestModeEnabled) return null;

  const { data, error } = await getSupabaseClient().auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      "게스트 모드 세션 생성 실패: Supabase에서 Anonymous sign-ins 설정을 확인하세요.",
    );
  }

  return data.user;
}

export async function signInWithKakao() {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo:
        typeof window !== "undefined"
          ? window.location.origin + "/auth/callback"
          : undefined,
      scopes: "profile_nickname profile_image",
    },
  });

  if (error) throw error;
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) throw error;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
}) {
  const { error } = await getSupabaseClient().auth.signUp({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) throw error;
}

export async function signOut() {
  const user = await getCurrentUser();
  const isKakaoUser = user?.app_metadata?.provider === "kakao";
  const kakaoRestApiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  const logoutRedirectUri =
    typeof window !== "undefined" ? window.location.origin + "/" : undefined;

  const { error } = await getSupabaseClient().auth.signOut();
  if (error && !error.message.toLowerCase().includes("auth session missing")) {
    throw error;
  }

  if (
    isKakaoUser &&
    kakaoRestApiKey &&
    logoutRedirectUri &&
    typeof window !== "undefined"
  ) {
    const kakaoLogoutUrl =
      "https://kauth.kakao.com/oauth/logout" +
      `?client_id=${encodeURIComponent(kakaoRestApiKey)}` +
      `&logout_redirect_uri=${encodeURIComponent(logoutRedirectUri)}`;

    window.location.assign(kakaoLogoutUrl);
  }
}

export async function requireUser() {
  const user = await ensureSessionUser();
  if (!user) {
    throw new Error(
      "로그인이 필요합니다. 카카오 또는 이메일 로그인 후 다시 시도하세요.",
    );
  }

  return user;
}
