"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Supabase SDK reads hash tokens and persists session automatically.
    void supabase.auth.getSession().finally(() => {
      router.replace("/");
    });
  }, [router]);

  return (
    <div className="flex min-h-[40dvh] items-center justify-center px-4 text-sm text-muted-foreground">
      로그인 처리 중...
    </div>
  );
}
