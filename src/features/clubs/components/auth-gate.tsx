import { FormEvent } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthGateProps = {
  loading: boolean;
  email: string;
  password: string;
  guestMode: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onKakaoSignIn: () => Promise<void>;
  onEmailSignIn: () => Promise<void>;
  onEmailSignUp: () => Promise<void>;
};

export function AuthGate({
  loading,
  email,
  password,
  guestMode,
  onChangeEmail,
  onChangePassword,
  onKakaoSignIn,
  onEmailSignIn,
  onEmailSignUp,
}: AuthGateProps) {
  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    await onEmailSignIn();
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">로그인/회원가입</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          카카오 또는 이메일로 계정을 연결하면 기록이 계속 보존됩니다.
        </p>
      </div>

      {guestMode ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          개발용 게스트 모드가 켜져 있습니다. 로그인 없이도 테스트 세션이 자동 생성됩니다.
        </p>
      ) : null}

      <Button
        className="w-full bg-[#FEE500] text-[#191600] hover:bg-[#f6de00]"
        onClick={() => void onKakaoSignIn()}
        disabled={loading}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            이동 중...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="size-4" />
            카카오로 시작하기
          </span>
        )}
      </Button>

      <form onSubmit={handleSignIn} className="space-y-3 rounded-xl border bg-background p-4">
        <div className="space-y-1.5">
          <Label htmlFor="auth-email">이메일</Label>
          <Input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => onChangeEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auth-password">비밀번호</Label>
          <Input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => onChangePassword(event.target.value)}
            placeholder="8자 이상"
            autoComplete="current-password"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button type="submit" disabled={loading}>
            이메일 로그인
          </Button>
          <Button type="button" variant="outline" onClick={() => void onEmailSignUp()} disabled={loading}>
            회원가입
          </Button>
        </div>
      </form>
    </section>
  );
}
