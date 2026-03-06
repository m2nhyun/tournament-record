"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MessageCircle, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBox } from "@/components/feedback/status-box";
import {
  getCurrentUser,
  signInAsGuest,
  signInWithEmail,
  signInWithKakao,
  signUpWithEmail,
} from "@/features/auth/services/auth";
import {
  joinClub,
  joinClubAsGuest,
} from "@/features/clubs/services/clubs";

type InviteJoinViewProps = {
  inviteCode: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function InviteJoinView({ inviteCode }: InviteJoinViewProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [busy, setBusy] = useState<"guest" | "kakao" | "email" | "join" | null>(
    null,
  );
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{
    type: "info" | "success" | "error";
    message: string;
  }>({
    type: "info",
    message: "초대 링크가 확인되었습니다. 로그인 또는 게스트로 참가할 수 있습니다.",
  });

  useEffect(() => {
    let mounted = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
        if (!nickname && currentUser?.user_metadata?.name) {
          setNickname(String(currentUser.user_metadata.name));
        }
      })
      .finally(() => {
        if (mounted) setLoadingSession(false);
      });
    return () => {
      mounted = false;
    };
  }, [nickname]);

  const normalizedCode = useMemo(
    () => inviteCode.trim().toUpperCase(),
    [inviteCode],
  );
  const isGuest = !!user?.is_anonymous;

  async function handleGuestContinue() {
    setBusy("guest");
    setStatus({ type: "info", message: "게스트 세션을 생성 중입니다..." });
    try {
      const sessionUser = await signInAsGuest();
      setUser(sessionUser);
      setStatus({
        type: "success",
        message: "게스트로 입장했습니다. 닉네임 입력 후 참가를 완료해주세요.",
      });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailSignIn(event: FormEvent) {
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
      setStatus({ type: "success", message: "로그인되었습니다. 참가를 진행하세요." });
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailSignUp() {
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
  }

  async function handleKakaoSignIn() {
    setBusy("kakao");
    try {
      await signInWithKakao();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusy(null);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) {
      setStatus({ type: "error", message: "활동 닉네임을 입력해주세요." });
      return;
    }
    if (!user) {
      setStatus({
        type: "error",
        message: "로그인 또는 게스트 입장 후 참가할 수 있습니다.",
      });
      return;
    }

    setBusy("join");
    try {
      const clubId = isGuest
        ? await joinClubAsGuest({ inviteCode: normalizedCode, nickname })
        : await joinClub({ inviteCode: normalizedCode, nickname });
      router.replace(`/clubs/${clubId}`);
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
      setBusy(null);
    }
  }

  if (loadingSession) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <section className="space-y-2 rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-semibold">초대 링크로 클럽 참가</h1>
        <p className="text-sm text-muted-foreground">
          코드 <span className="font-mono font-semibold">{normalizedCode}</span>
        </p>
      </section>

      <StatusBox type={status.type} message={status.message} />

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

          <form onSubmit={handleEmailSignIn} className="space-y-3 rounded-xl border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">이메일</Label>
              <Input
                id="invite-email"
                value={email}
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">비밀번호</Label>
              <Input
                id="invite-password"
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8자 이상"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="submit" disabled={busy !== null}>
                <Mail className="size-4" />
                이메일 로그인
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleEmailSignUp()}
                disabled={busy !== null}
              >
                회원가입
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {user ? (
        <form onSubmit={handleJoin} className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
            현재 모드: {isGuest ? "게스트 참가 (조회/참가만 가능)" : "정회원 참가"}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-nickname">활동 닉네임</Label>
            <Input
              id="invite-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="클럽에서 사용할 이름"
              maxLength={24}
            />
          </div>
          <Button className="w-full" disabled={busy !== null}>
            {busy === "join" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                참가 처리 중...
              </>
            ) : (
              "클럽 참가 완료"
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
