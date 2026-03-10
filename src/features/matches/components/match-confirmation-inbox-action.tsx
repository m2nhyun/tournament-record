"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/common/modal";
import { StatusBox } from "@/components/feedback/status-box";
import { Button } from "@/components/ui/button";
import { usePendingMatchConfirmations } from "@/features/matches/hooks/use-pending-match-confirmations";

type MatchConfirmationInboxActionProps = {
  clubId: string;
};

function formatPlayedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

export function MatchConfirmationInboxAction({
  clubId,
}: MatchConfirmationInboxActionProps) {
  const [open, setOpen] = useState(false);
  const { items, loading, error } = usePendingMatchConfirmations(clubId);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label="확인 요청 보기"
      >
        <Bell className="size-4" />
        {items.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-semibold text-white">
            {items.length}
          </span>
        ) : null}
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="확인 요청">
        <div className="space-y-3">
          {error ? <StatusBox type="error" message={error} /> : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">확인 요청을 불러오는 중...</p>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              현재 처리할 경기 확인 요청이 없습니다.
            </p>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/clubs/${clubId}/matches/${item.matchId}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg border px-3 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {item.matchType === "singles" ? "단식" : "복식"} 경기 확인
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPlayedAt(item.playedAt)} · 상세에서 승인 또는 거절
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[var(--brand)]">
                      열기
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
