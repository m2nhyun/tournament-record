"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { StatusBox } from "@/components/feedback/status-box";
import { AppBar } from "@/components/layout/app-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, signOut } from "@/features/auth/services/auth";
import {
  getDefaultDisplayNameSeed,
  getMyProfile,
  type ProfileGender,
  upsertMyProfile,
} from "@/features/auth/services/profile";
import { cn } from "@/lib/utils";

type StatusState = {
  type: "info" | "success" | "error";
  message: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "프로필 저장 중 오류가 발생했습니다.";
}

const genderOptions: Array<{
  value: ProfileGender;
  label: string;
  description: string;
}> = [
  { value: "male", label: "남성", description: "남복 모집과 연결될 수 있어요." },
  { value: "female", label: "여성", description: "여복 모집과 연결될 수 있어요." },
  {
    value: "unspecified",
    label: "나중에 정할게요",
    description: "기본 프로필만 먼저 마칠 수 있어요.",
  },
];

export function ProfileOnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<ProfileGender | null>(null);
  const [nextPath, setNextPath] = useState("/");
  const [status, setStatus] = useState<StatusState>({
    type: "info",
    message: "활동 이름과 성별을 저장하면 정회원 기능을 계속 사용할 수 있습니다.",
  });

  useEffect(() => {
    let mounted = true;

    void Promise.all([getCurrentUser(), getMyProfile(), getDefaultDisplayNameSeed()])
      .then(([user, profile, seedName]) => {
        if (!mounted) return;

        const next =
          typeof window !== "undefined"
            ? new URL(window.location.href).searchParams.get("next") || "/"
            : "/";
        setNextPath(next);

        if (!user || user.is_anonymous) {
          router.replace("/");
          return;
        }

        if (profile?.profileCompleted) {
          router.replace(nextPath);
          return;
        }

        setDisplayName(profile?.displayName ?? seedName);
        setGender(profile?.gender ?? null);
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus({ type: "error", message: toMessage(error) });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [nextPath, router]);

  async function handleSubmit() {
    if (!displayName.trim()) {
      setStatus({ type: "error", message: "활동 이름을 입력해주세요." });
      return;
    }

    if (!gender) {
      setStatus({ type: "error", message: "성별을 선택해주세요." });
      return;
    }

    setSaving(true);
    try {
      await upsertMyProfile({ displayName, gender });
      setStatus({ type: "success", message: "프로필을 저장했습니다. 계속 진행합니다." });
      router.replace(nextPath);
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <AppBar
        title="기본 프로필 설정"
        showBack={false}
        actions={
          <Button size="sm" variant="outline" onClick={() => void handleSignOut()}>
            로그아웃
          </Button>
        }
      />
      <div className="space-y-5 px-4 py-4">
        <section className="space-y-2 rounded-2xl border bg-card p-5">
          <h1 className="text-xl font-semibold tracking-tight">프로필을 마무리해주세요</h1>
          <p className="text-sm text-muted-foreground">
            클럽 생성, 일정 등록, 경기 저장 같은 정회원 기능을 쓰려면 기본 프로필이 필요합니다.
          </p>
        </section>

        <StatusBox type={status.type} message={status.message} />

        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="profile-display-name">활동 이름</Label>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="클럽에서 기본으로 보여줄 이름"
              maxLength={24}
              autoComplete="nickname"
            />
            <p className="text-xs text-muted-foreground">
              클럽별 닉네임은 나중에 따로 정할 수 있습니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label>성별</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {genderOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGender(option.value)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    gender === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground",
                  )}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div
                    className={cn(
                      "mt-1 text-xs",
                      gender === option.value
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                저장 중...
              </span>
            ) : (
              "프로필 저장하고 계속"
            )}
          </Button>
        </section>
      </div>
    </div>
  );
}
