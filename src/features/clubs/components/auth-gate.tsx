import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type AuthGateProps = {
  loading: boolean;
  onSignIn: () => Promise<void>;
};

export function AuthGate({ loading, onSignIn }: AuthGateProps) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="text-xl font-semibold tracking-tight">로그인이 필요합니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        클럽 생성/참가와 기록 저장을 위해 카카오 로그인으로 계정을 연결하세요.
      </p>

      <Button
        className="mt-5 w-full bg-[#FEE500] text-[#191600] hover:bg-[#f6de00]"
        onClick={() => void onSignIn()}
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
    </section>
  );
}
