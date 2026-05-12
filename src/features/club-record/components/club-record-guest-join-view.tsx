"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import { StatusBox } from "@/components/feedback/status-box";
import { AppBar } from "@/components/layout/app-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCurrentUser,
  signInAsGuest,
  signInWithEmail,
  signInWithKakao,
  signUpWithEmail,
} from "@/features/auth/services/auth";
import {
  joinEventAsGuestByInviteCode,
  verifyGuestInviteCode,
} from "@/features/club-record/services/guests";
import type {
  ClubRecordGuestInviteVerification,
  ClubRecordGuestJoinResult,
} from "@/features/club-record/types/guest";

type ClubRecordGuestJoinViewProps = {
  inviteCode: string;
};

type StatusState = {
  type: "info" | "success" | "error";
  message: string;
};

function formatDateLabel(eventDate: string) {
  return new Date(eventDate).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "게스트 참가 처리 중 오류가 발생했습니다.";
}

function getUserDisplayName(user: User | null) {
  const metadataName = user?.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const emailPrefix = user?.email?.split("@")[0];
  if (emailPrefix?.trim()) return emailPrefix.trim();

  return "";
}

function EventSummaryCard({
  verification,
}: {
  verification: ClubRecordGuestInviteVerification;
}) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div>
        <p className="text-xs text-muted-foreground">이벤트 일정</p>
        <h1 className="mt-1 text-xl font-semibold">클럽 레코드 게스트 참가</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">날짜</p>
          <p className="mt-1 font-medium">
            {formatDateLabel(verification.eventDate)}
          </p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">시간</p>
          <p className="mt-1 font-medium">
            {formatTimeLabel(verification.startsAt)} -{" "}
            {formatTimeLabel(verification.endsAt)}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ClubRecordGuestJoinView({
  inviteCode,
}: ClubRecordGuestJoinViewProps) {
  const normalizedCode = useMemo(
    () => inviteCode.trim().toUpperCase(),
    [inviteCode],
  );
  const [user, setUser] = useState<User | null>(null);
  const [verification, setVerification] =
    useState<ClubRecordGuestInviteVerification | null>(null);
  const [joined, setJoined] = useState<ClubRecordGuestJoinResult | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [busy, setBusy] = useState<"guest" | "kakao" | "email" | "join" | null>(
    null,
  );
  const [status, setStatus] = useState<StatusState>({
    type: "info",
    message: "로그인 또는 게스트 입장 후 참가할 수 있습니다.",
  });

  useEffect(() => {
    let mounted = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
        setDisplayName((current) => current || getUserDisplayName(currentUser));
      })
      .finally(() => {
        if (mounted) setLoadingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loadingSession) return;

    if (!user) {
      setVerification(null);
      setLoadingInvite(false);
      setStatus({
        type: "info",
        message: "로그인하거나 게스트로 입장하면 초대코드를 확인합니다.",
      });
      return;
    }

    let active = true;

    const load = async () => {
      setLoadingInvite(true);
      try {
        const nextVerification = await verifyGuestInviteCode(normalizedCode);
        if (!active) return;
        setVerification(nextVerification);
        setStatus({
          type: "info",
          message: "게스트 이름을 입력하면 참가가 완료됩니다.",
        });
      } catch (error) {
        if (!active) return;
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        if (active) setLoadingInvite(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [loadingSession, normalizedCode, user]);

  const handleGuestContinue = async () => {
    setBusy("guest");
    setStatus({ type: "info", message: "게스트 세션을 생성하는 중입니다." });
    try {
      const sessionUser = await signInAsGuest();
      setUser(sessionUser);
      setStatus({
        type: "success",
        message: "게스트로 입장했습니다. 초대코드를 확인합니다.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleKakaoSignIn = async () => {
    setBusy("kakao");
    try {
      await signInWithKakao();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusy(null);
    }
  };

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setStatus({ type: "error", message: "이메일과 비밀번호를 입력해주세요." });
      return;
    }

    setBusy("email");
    try {
      await signInWithEmail({ email, password });
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setDisplayName((current) => current || getUserDisplayName(currentUser));
      setStatus({ type: "success", message: "로그인되었습니다. 초대코드를 확인합니다." });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setStatus({ type: "error", message: "이메일과 비밀번호를 입력해주세요." });
      return;
    }

    setBusy("email");
    try {
      await signUpWithEmail({ email, password });
      setStatus({
        type: "success",
        message: "회원가입 요청이 완료되었습니다. 이메일 인증 후 로그인해주세요.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setStatus({
        type: "error",
        message: "로그인 또는 게스트 입장 후 참가할 수 있습니다.",
      });
      return;
    }

    if (!displayName.trim()) {
      setStatus({ type: "error", message: "이름을 입력해주세요." });
      return;
    }

    setBusy("join");
    setStatus({
      type: "info",
      message: "게스트 참가를 등록하는 중입니다.",
    });

    try {
      const result = await joinEventAsGuestByInviteCode(normalizedCode, {
        displayName,
      });
      setJoined(result);
      setVerification(result.verification);
      setDisplayName(result.guestProfile.displayName ?? displayName.trim());
      setStatus({
        type: "success",
        message:
          "게스트 참가가 완료되었습니다. 운영진이 참가자 목록에서 바로 확인할 수 있습니다.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  if (loadingSession || loadingInvite) {
    return (
      <div className="space-y-4">
        <AppBar title="게스트 참가" showBack />
        <div className="flex min-h-[50dvh] items-center justify-center px-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AppBar title="게스트 참가" showBack />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-24">
        <section className="space-y-2 rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">게스트 초대코드</p>
          <p className="break-all font-mono text-xl font-semibold">
            {normalizedCode}
          </p>
          <p className="text-sm text-muted-foreground">
            클럽 레코드 이벤트 참가용 코드입니다. 게스트는 참가 등록만 가능하며
            운영 화면 편집 권한은 없습니다.
          </p>
        </section>

        <StatusBox type={status.type} message={status.message} />

        {verification ? <EventSummaryCard verification={verification} /> : null}

        {!user ? (
          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <Button
              className="w-full bg-[#FEE500] text-[#191600] hover:bg-[#f6de00]"
              onClick={() => void handleKakaoSignIn()}
              disabled={busy !== null}
            >
              <MessageCircle className="size-4" />
              카카오로 계속
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => void handleGuestContinue()}
              disabled={busy !== null}
            >
              <UserRound className="size-4" />
              게스트로 계속
            </Button>

            <form
              onSubmit={handleEmailSignIn}
              className="space-y-3 rounded-xl border p-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="club-record-guest-email">이메일</Label>
                <Input
                  id="club-record-guest-email"
                  value={email}
                  type="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="club-record-guest-password">비밀번호</Label>
                <Input
                  id="club-record-guest-password"
                  value={password}
                  type="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="submit" disabled={busy !== null}>
                  <Mail className="size-4" />
                  이메일 로그인
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void handleEmailSignUp()}
                >
                  회원가입
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {joined ? (
          <section className="space-y-3 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-5">
            <div className="flex items-center gap-2 text-[var(--brand)]">
              <CheckCircle2 className="size-5" />
              <h2 className="text-lg font-semibold">참가 완료</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {joined.guestProfile.displayName ?? displayName} 님으로 참가
              등록되었습니다.
            </p>
            <p className="text-xs text-muted-foreground">
              운영진이 참가자 목록에서 도착 시간과 편성을 이어서 관리합니다.
            </p>
          </section>
        ) : verification ? (
          <form
            onSubmit={handleJoin}
            className="space-y-4 rounded-2xl border bg-card p-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="club-record-guest-name">이름</Label>
              <Input
                id="club-record-guest-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="참가자 이름"
                autoComplete="name"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy !== null}>
              <UserRoundPlus className="size-4" />
              {busy === "join" ? "참가 등록 중..." : "게스트 참가 완료"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
