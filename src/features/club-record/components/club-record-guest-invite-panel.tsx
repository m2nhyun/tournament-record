"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Link2, Loader2, RefreshCw, ShieldOff } from "lucide-react";

import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createGuestInvite,
  disableGuestInvite,
  getGuestInvite,
} from "@/features/club-record/services/guests";
import type { ClubRecordGuestInvite } from "@/features/club-record/types/guest";

type ClubRecordGuestInvitePanelProps = {
  eventId: string;
};

type StatusState = {
  type: "success" | "error";
  message: string;
} | null;

export function ClubRecordGuestInvitePanel({
  eventId,
}: ClubRecordGuestInvitePanelProps) {
  const [invite, setInvite] = useState<ClubRecordGuestInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const nextInvite = await getGuestInvite(eventId);
        if (!active) return;
        setInvite(nextInvite);
      } catch (error) {
        if (!active) return;
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "게스트 초대코드를 불러오지 못했습니다.",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  const handleGenerate = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const nextInvite = await createGuestInvite(eventId);
      setInvite(nextInvite);
      setStatus({ type: "success", message: "게스트 초대코드를 생성했습니다." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "게스트 초대코드 생성 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await disableGuestInvite(eventId);
      setInvite((current) => (current ? { ...current, isActive: false } : current));
      setStatus({ type: "success", message: "게스트 초대코드를 비활성화했습니다." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "게스트 초대코드 비활성화 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!invite?.code) return;

    try {
      await navigator.clipboard.writeText(invite.code);
      setStatus({ type: "success", message: "게스트 초대코드를 복사했습니다." });
    } catch {
      setStatus({ type: "error", message: "클립보드 복사에 실패했습니다." });
    }
  };

  const handleCopyLink = async () => {
    if (!invite?.code || typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/club-record/join/${invite.code}`,
      );
      setStatus({ type: "success", message: "게스트 참가 링크를 복사했습니다." });
    } catch {
      setStatus({ type: "error", message: "링크 복사에 실패했습니다." });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>게스트 초대코드</CardTitle>
          {invite ? (
            <Badge variant={invite.isActive ? "brand" : "default"}>
              {invite.isActive ? "활성" : "비활성"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        {loading ? (
          <div className="flex min-h-16 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : invite ? (
          <div className="space-y-3">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">현재 코드</p>
              <p className="mt-2 break-all font-mono text-2xl font-semibold">
                {invite.code}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="size-4" />
                복사
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
                <Link2 className="size-4" />
                링크 복사
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void handleGenerate()}>
                <RefreshCw className="size-4" />
                재발급
              </Button>
              {invite.isActive ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void handleDisable()}>
                  <ShieldOff className="size-4" />
                  비활성화
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-dashed p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                아직 게스트 초대코드가 없습니다.
              </p>
            </div>
            <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
              <KeyRound className="size-4" />
              초대코드 생성
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
