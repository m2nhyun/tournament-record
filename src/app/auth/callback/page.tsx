"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser } from "@/features/auth/services/auth";
import { getMyProfile } from "@/features/auth/services/profile";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    const nextPath =
      typeof window !== "undefined"
        ? new URL(window.location.href).searchParams.get("next") || "/"
        : "/";

    // Supabase SDK reads hash tokens and persists session automatically.
    void supabase.auth
      .getSession()
      .then(async () => {
        const user = await getCurrentUser();
        if (!user || user.is_anonymous) {
          router.replace("/");
          return;
        }

        const profile = await getMyProfile();
        if (!profile?.profileCompleted) {
          router.replace(
            `/onboarding/profile?next=${encodeURIComponent(nextPath)}`,
          );
          return;
        }

        router.replace(nextPath);
      })
      .catch(() => {
        router.replace("/");
      });
  }, [router]);

  return (
    <div className="flex min-h-[40dvh] items-center justify-center px-4 text-sm text-muted-foreground">
      로그인 처리 중...
    </div>
  );
}
