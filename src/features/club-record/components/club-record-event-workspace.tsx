"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, PlusCircle, RefreshCw, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppBar } from "@/components/layout/app-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClubRecordEventEditDialog } from "@/features/club-record/components/club-record-event-edit-dialog";
import { ClubRecordGuestInvitePanel } from "@/features/club-record/components/club-record-guest-invite-panel";
import { ClubRecordMatchControls } from "@/features/club-record/components/club-record-match-controls";
import { ClubRecordParticipantManager } from "@/features/club-record/components/club-record-participant-manager";
import { useClubRecordAccess } from "@/features/club-record/hooks/use-club-record-access";
import { runAutoAssignment } from "@/features/club-record/services/assignment";
import { archiveClubRecordEvent } from "@/features/club-record/services/events";
import { useClubRecordEventWorkspace } from "@/features/club-record/hooks/use-club-record-event-workspace";

type ClubRecordEventWorkspaceViewProps = {
  clubId: string;
  eventId: string;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMatchStatusLabel(status: string) {
  if (status === "pending_result") return "결과 대기";
  if (status === "confirmed") return "확정";
  if (status === "cancelled") return "취소";
  return status;
}

function getSlotStatusLabel(status: string) {
  if (status === "scheduled") return "예정";
  if (status === "ready") return "준비";
  if (status === "completed") return "완료";
  if (status === "cancelled") return "취소";
  return status;
}

function isPastOrClosedEvent(
  event: {
    endsAt: string;
    status: string;
    isDeleted: boolean;
  },
  currentTime: number,
) {
  if (event.isDeleted) return true;
  if (event.status === "cancelled" || event.status === "completed") return true;
  return new Date(event.endsAt).getTime() < currentTime;
}

export function ClubRecordEventWorkspaceView({
  clubId,
  eventId,
}: ClubRecordEventWorkspaceViewProps) {
  const router = useRouter();
  const { workspace, loading, error, refresh } = useClubRecordEventWorkspace(eventId);
  const { access } = useClubRecordAccess(clubId);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [status, setStatus] = useState<null | {
    type: "success" | "error" | "info";
    message: string;
  }>(null);
  const [currentTime] = useState(() => Date.now());

  const participantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of workspace?.participants ?? []) {
      map.set(participant.id, participant.displayName);
    }
    return map;
  }, [workspace?.participants]);

  const myParticipantId = useMemo(() => {
    if (!access?.clubMemberId) return null;
    const me = (workspace?.participants ?? []).find(
      (participant) => participant.clubMemberId === access.clubMemberId,
    );
    return me?.id ?? null;
  }, [access?.clubMemberId, workspace?.participants]);

  if (loading) {
    return <LoadingSpinner title="로딩 중" message="이벤트 워크스페이스를 불러오는 중..." />;
  }

  if (error || !workspace) {
    return (
      <div className="space-y-4">
        <AppBar title="이벤트" showBack />
        <div className="space-y-4 px-4 pt-4">
          <StatusBox type="error" message={error ?? "이벤트를 불러오지 못했습니다."} />
          <Button variant="outline" asChild>
            <Link href={`/clubs/${clubId}/club-record`}>목록으로 돌아가기</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isReadOnlyEvent = isPastOrClosedEvent(workspace.event, currentTime);

  const handleRunAutoAssignment = async () => {
    if (isReadOnlyEvent) {
      setStatus({
        type: "info",
        message: "지난 이벤트에서는 자동 편성을 다시 실행하지 않습니다.",
      });
      return;
    }

    if (!workspace.event.assignmentDirty && workspace.summary.openSlotCount === 0) {
      setStatus({
        type: "info",
        message: "재편성이 필요한 변경이나 열린 슬롯이 없습니다.",
      });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      await runAutoAssignment(eventId);
      setStatus({
        type: "success",
        message: "자동 편성을 적용했습니다.",
      });
      await refresh();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "자동 편성 적용 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveEvent = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await archiveClubRecordEvent(eventId);
      router.push(`/clubs/${clubId}/club-record`);
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "이벤트 취소 실패",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AppBar
        title={workspace.event.title?.trim() || "데일리 매치"}
        actions={
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
          </Button>
        }
      />
      <div className="space-y-6 px-4">
        {status ? <StatusBox type={status.type} message={status.message} /> : null}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>이벤트 요약</CardTitle>
              <div className="flex gap-2">
                <Badge variant="brand">{workspace.event.status}</Badge>
                {isReadOnlyEvent ? <Badge variant="default">지난 이벤트</Badge> : null}
                {workspace.event.assignmentDirty ? (
                  <Badge variant="warning">변경됨</Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">시간</p>
              <p className="mt-1 font-medium">
                {formatTime(workspace.event.startsAt)} - {formatTime(workspace.event.endsAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {access?.capabilities.canManageParticipants && !isReadOnlyEvent ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/clubs/${clubId}/club-record/new`}>
                    <PlusCircle className="size-4" />
                    새 이벤트
                  </Link>
                </Button>
              ) : null}
              {access?.capabilities.canManageClubData && !isReadOnlyEvent ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-4" />
                  이벤트 수정
                </Button>
              ) : null}
              {access?.capabilities.canManageClubData && !isReadOnlyEvent ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setArchiveConfirmOpen(true)}
                >
                  <Trash2 className="size-4" />
                  이벤트 취소
                </Button>
              ) : null}
              {workspace.summary.hasConfirmedAutoMatch ? (
                <Badge variant="destructive">확정된 자동 경기 존재</Badge>
              ) : null}
            </div>
            {isReadOnlyEvent ? (
              <StatusBox
                type="info"
                message="종료된 이벤트입니다. 참가자와 편성은 읽기 전용으로 보고, 운영진만 필요한 경우 결과를 사후 입력하거나 수정할 수 있습니다."
              />
            ) : null}
            {!isReadOnlyEvent &&
            (workspace.summary.openSlotCount > 0 || workspace.event.assignmentDirty) ? (
              <Button
                onClick={() => void handleRunAutoAssignment()}
                disabled={busy}
              >
                <CalendarDays className="size-4" />
                {busy ? "자동 편성 적용 중..." : "자동 편성 실행"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이벤트 취소</AlertDialogTitle>
              <AlertDialogDescription>
                이 이벤트를 취소하면 목록에서 숨겨집니다. 계속할까요?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>닫기</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={busy}
                onClick={() => void handleArchiveEvent()}
              >
                이벤트 취소
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {access?.capabilities.canManageClubData && !isReadOnlyEvent ? (
          <ClubRecordEventEditDialog
            event={workspace.event}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={refresh}
          />
        ) : null}

        {access?.capabilities.canManageParticipants ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <ClubRecordParticipantManager
              clubId={clubId}
              eventId={eventId}
              startsAt={workspace.event.startsAt}
              endsAt={workspace.event.endsAt}
              participants={workspace.participants}
              onChanged={refresh}
              readOnly={isReadOnlyEvent}
            />
            {access.capabilities.canManageGuestInvites && !isReadOnlyEvent ? (
              <ClubRecordGuestInvitePanel eventId={eventId} />
            ) : null}
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">시간대별 보드</h2>
          {workspace.board.timeGroups.length > 0 ? (
            <div className="space-y-4">
              {workspace.board.timeGroups.map((group) => (
                <Card key={`${group.startsAt}-${group.endsAt}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>
                        {formatTime(group.startsAt)} - {formatTime(group.endsAt)}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="default">열린 슬롯 {group.openSlotIds.length}</Badge>
                        <Badge variant="brand">
                          가능 인원 {group.availableParticipantIds.length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {workspace.board.slots
                        .filter((slot) => group.slotIds.includes(slot.id))
                        .map((slot) => (
                          <div key={slot.id} className="rounded-xl border bg-muted/10 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{slot.courtNumber}번 코트</p>
                                  {myParticipantId &&
                                  slot.match?.players.some(
                                    (player) => player.participantId === myParticipantId,
                                  ) ? (
                                    <Badge variant="brand">내 경기</Badge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  슬롯 {slot.slotOrder} · {getSlotStatusLabel(slot.status)}
                                </p>
                              </div>
                              {slot.match ? (
                                <Badge
                                  variant={
                                    slot.match.status === "confirmed"
                                      ? "success"
                                      : slot.match.assignmentMode === "manual"
                                        ? "default"
                                        : "brand"
                                  }
                                >
                                  {slot.match.assignmentMode === "manual" ? "수동" : "자동"} ·{" "}
                                  {getMatchStatusLabel(slot.match.status)}
                                </Badge>
                              ) : (
                                <Badge variant="warning">비어 있음</Badge>
                              )}
                            </div>
                            {slot.match ? (
                              <div className="mt-3 space-y-2">
                                <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                                  <p className="font-medium">
                                    팀 1:{" "}
                                    {slot.match.players
                                      .filter((player) => player.side === 1)
                                      .map((player, index, list) => (
                                        <span key={player.participantId}>
                                          {index > 0 ? ", " : ""}
                                          <span
                                            className={
                                              player.participantId === myParticipantId
                                                ? "font-semibold text-[var(--player-highlight)]"
                                                : undefined
                                            }
                                          >
                                            {player.displayName}
                                            {player.participantId === myParticipantId
                                              ? " (나)"
                                              : ""}
                                          </span>
                                          {index === list.length - 1 ? "" : ""}
                                        </span>
                                      ))}
                                  </p>
                                  <p className="mt-1 font-medium">
                                    팀 2:{" "}
                                    {slot.match.players
                                      .filter((player) => player.side === 2)
                                      .map((player, index, list) => (
                                        <span key={player.participantId}>
                                          {index > 0 ? ", " : ""}
                                          <span
                                            className={
                                              player.participantId === myParticipantId
                                                ? "font-semibold text-[var(--player-highlight)]"
                                                : undefined
                                            }
                                          >
                                            {player.displayName}
                                            {player.participantId === myParticipantId
                                              ? " (나)"
                                              : ""}
                                          </span>
                                          {index === list.length - 1 ? "" : ""}
                                        </span>
                                      ))}
                                  </p>
                                </div>
                                {slot.match.scoreText ? (
                                  <p className="text-xs text-muted-foreground">
                                    결과: {slot.match.scoreText}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground">
                                  이 슬롯에서 가능한 인원:{" "}
                                  {slot.availableParticipantIds.length > 0
                                    ? slot.availableParticipantIds
                                        .map((id) => participantNameMap.get(id) ?? id)
                                        .join(", ")
                                    : "없음"}
                                </p>
                              </div>
                            )}
                            <ClubRecordMatchControls
                              eventId={eventId}
                              slot={slot}
                              participants={workspace.participants}
                              swapEligibleParticipantIds={(() => {
                                if (!slot.match) return [];
                                const timeGroup = workspace.board.timeGroups.find(
                                  (group) =>
                                    group.startsAt === slot.startsAt &&
                                    group.endsAt === slot.endsAt,
                                );
                                const ids = new Set<string>();
                                for (const player of slot.match.players) {
                                  ids.add(player.participantId);
                                }
                                for (const id of timeGroup?.availableParticipantIds ?? []) {
                                  ids.add(id);
                                }
                                return Array.from(ids);
                              })()}
                              access={access}
                              onChanged={refresh}
                              readOnly={isReadOnlyEvent}
                            />
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="보드가 비어 있습니다."
              description="슬롯이 생성되고 참가자가 채워지면 시간대별 보드를 볼 수 있습니다."
            />
          )}
        </section>
      </div>
    </div>
  );
}
