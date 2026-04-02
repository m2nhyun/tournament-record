import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/features/auth/services/auth";

export type ProfileGender = "male" | "female" | "unspecified";

export type UserProfile = {
  userId: string;
  displayName: string | null;
  gender: ProfileGender | null;
  profileCompleted: boolean;
  authProvider: string | null;
};

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  gender: ProfileGender | null;
  profile_completed: boolean;
  auth_provider: string | null;
};

function isNoRowsError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST116"
  );
}

function mapProfile(row: UserProfileRow): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    gender: row.gender,
    profileCompleted: row.profile_completed,
    authProvider: row.auth_provider,
  };
}

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function detectAuthProvider() {
  return getCurrentUser().then((user) => {
    if (!user) return null;

    const provider =
      typeof user.app_metadata?.provider === "string"
        ? user.app_metadata.provider
        : typeof user.user_metadata?.provider === "string"
          ? user.user_metadata.provider
          : null;

    if (provider) return provider;
    if (user.email) return "email";
    return null;
  });
}

export function getDefaultDisplayNameSeed() {
  return getCurrentUser().then((user) => {
    if (!user) return "";

    const candidates = [
      user.user_metadata?.name,
      user.user_metadata?.full_name,
      user.user_metadata?.nickname,
      user.user_metadata?.preferred_username,
      user.email?.split("@")[0],
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return normalizeDisplayName(candidate);
      }
    }

    return "";
  });
}

export async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user || user.is_anonymous) return null;

  const { data, error } = await getSupabaseClient()
    .from("user_profiles")
    .select("user_id, display_name, gender, profile_completed, auth_provider")
    .eq("user_id", user.id)
    .single<UserProfileRow>();

  if (error) {
    if (isNoRowsError(error)) return null;
    throw error;
  }

  return mapProfile(data);
}

export async function isProfileComplete() {
  const profile = await getMyProfile();
  return profile?.profileCompleted ?? false;
}

export async function requireCompletedProfile() {
  const user = await getCurrentUser();
  if (!user || user.is_anonymous) {
    throw new Error("정회원 로그인 후 이용해주세요.");
  }

  const profile = await getMyProfile();
  if (!profile?.profileCompleted) {
    throw new Error(
      "기본 프로필을 먼저 완료해주세요. 활동 이름과 성별을 저장하면 계속할 수 있습니다.",
    );
  }

  return profile;
}

export async function upsertMyProfile(input: {
  displayName: string;
  gender: ProfileGender;
}) {
  const user = await getCurrentUser();
  if (!user || user.is_anonymous) {
    throw new Error("정회원 로그인 후 프로필을 저장할 수 있습니다.");
  }

  const displayName = normalizeDisplayName(input.displayName);
  if (displayName.length < 2 || displayName.length > 24) {
    throw new Error("활동 이름은 2자 이상 24자 이하로 입력해주세요.");
  }

  const authProvider = await detectAuthProvider();

  const payload = {
    user_id: user.id,
    display_name: displayName,
    gender: input.gender,
    profile_completed: true,
    auth_provider: authProvider,
  };

  const { data, error } = await getSupabaseClient()
    .from("user_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, display_name, gender, profile_completed, auth_provider")
    .single<UserProfileRow>();

  if (error) throw error;

  return mapProfile(data);
}
