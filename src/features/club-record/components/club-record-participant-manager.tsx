"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Clock, UserPlus, UserRoundMinus, Users } from "lucide-react";

import { Modal } from "@/components/common/modal";
import { LoadingSpinner } from "@/components/feedback/loading-spinner";
import { StatusBox } from "@/components/feedback/status-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listClubMembers } from "@/features/clubs/services/clubs";
import type { ClubMember } from "@/features/clubs/types/club";
import {
  addGuestParticipant,
  addMemberParticipant,
  removeParticipant,
  updateParticipantArrivalTime,
} from "@/features/club-record/services/participants";
import { createManualGuestProfile } from "@/features/club-record/services/guests";
import type { ClubRecordGroupCode } from "@/features/club-record/types/member";
import type { ClubRecordEventParticipant } from "@/features/club-record/types/participant";

type ClubRecordParticipantManagerProps = {
  clubId: string;
  eventId: string;
  startsAt: string;
  endsAt: string;
  participants: ClubRecordEventParticipant[];
  onChanged: () => Promise<void>;
  readOnly?: boolean;
};

type StatusState = {
  type: "success" | "error";
  message: string;
} | null;

type AddParticipantTab = "members" | "guest";

const memberRoleLabels = {
  owner: "관리자",
  manager: "운영진",
  member: "회원",
  guest: "게스트",
} as const;

export function ClubRecordParticipantManager({
  clubId,
  eventId,
  startsAt,
  endsAt,
  participants,
  onChanged,
  readOnly = false,
}: ClubRecordParticipantManagerProps) {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [status, setStatus] = useState<StatusState>(null);
  const [memberBusy, setMemberBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addTab, setAddTab] = useState<AddParticipantTab>("members");
  const [selectedClubMemberIds, setSelectedClubMemberIds] = useState<string[]>([]);
  const [memberArrivalTime, setMemberArrivalTime] = useState("");

  const [arrivalEditTarget, setArrivalEditTarget] =
    useState<ClubRecordEventParticipant | null>(null);
  const [arrivalEditTime, setArrivalEditTime] = useState("");
  const [arrivalEditBusy, setArrivalEditBusy] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestGender, setGuestGender] = useState("");
  const [guestCareerText, setGuestCareerText] = useState("");
  const [guestGroupCode, setGuestGroupCode] = useState<"" | ClubRecordGroupCode>("");
  const [guestOperatorNote, setGuestOperatorNote] = useState("");
  const [guestArrivalTime, setGuestArrivalTime] = useState("");

  // 시작 시간(첫 슬롯)은 "정시" 옵션과 같은 의미라 옵션에서 제외한다.
  // 늦참 입력이 의미 있는 30분 단위 후속 슬롯만 노출.
  const arrivalOptions = useMemo(() => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const values: string[] = [];

    const cursor = new Date(start);
    cursor.setMinutes(cursor.getMinutes() + 30);
    while (cursor.getTime() < end.getTime() - 30 * 60 * 1000) {
      const hours = String(cursor.getHours()).padStart(2, "0");
      const minutes = String(cursor.getMinutes()).padStart(2, "0");
      values.push(`${hours}:${minutes}`);
      cursor.setMinutes(cursor.getMinutes() + 30);
    }

    return values;
  }, [endsAt, startsAt]);

  // 참가자 행에서 도착 시간을 사람이 읽을 수 있는 HH:MM 으로 표시한다.
  // arrival_time 컬럼은 ISO 타임스탬프라 그대로 노출하면 깨진 글자가 보인다.
  const formatArrivalLabel = (value: string | null) => {
    if (!value) return "정시 참가";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return `${value} 도착`;
    }
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes} 도착`;
  };

  // 도착 시간 변경 모달이 열릴 때 ISO → HH:MM 으로 prefill.
  const isoToHHmm = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const toArrivalTimestamp = (value: string) => {
    if (!value) return null;

    const [hoursText, minutesText] = value.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      throw new Error("도착 시간 형식이 올바르지 않습니다.");
    }

    const base = new Date(startsAt);
    base.setHours(hours, minutes, 0, 0);
    return base.toISOString();
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (readOnly) {
        setLoadingMembers(false);
        return;
      }

      setLoadingMembers(true);
      try {
        const nextMembers = await listClubMembers(clubId);
        if (!active) return;
        setMembers(nextMembers);
      } catch (error) {
        if (!active) return;
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "클럽 멤버를 불러오지 못했습니다.",
        });
      } finally {
        if (active) setLoadingMembers(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [clubId, readOnly]);

  const joinedMemberIds = useMemo(
    () =>
      new Set(
        participants
          .map((participant) => participant.clubMemberId)
          .filter((clubMemberId): clubMemberId is string => Boolean(clubMemberId)),
      ),
    [participants],
  );

  const availableMembers = useMemo(
    () =>
      members.filter(
        (member) => member.role !== "guest" && !joinedMemberIds.has(member.id),
      ),
    [joinedMemberIds, members],
  );

  const selectedClubMemberIdSet = useMemo(
    () => new Set(selectedClubMemberIds),
    [selectedClubMemberIds],
  );

  const toggleSelectedClubMember = (memberId: string) => {
    setSelectedClubMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const handleAddMembers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedClubMemberIds.length === 0) {
      setStatus({ type: "error", message: "참가시킬 회원을 선택해주세요." });
      return;
    }

    setMemberBusy(true);
    setStatus(null);
    try {
      const arrivalTime = toArrivalTimestamp(memberArrivalTime);
      for (const clubMemberId of selectedClubMemberIds) {
        await addMemberParticipant(eventId, {
          clubMemberId,
          arrivalTime,
        });
      }
      setStatus({
        type: "success",
        message: `${selectedClubMemberIds.length}명의 회원을 참가자로 추가했습니다.`,
      });
      setMemberArrivalTime("");
      setSelectedClubMemberIds([]);
      setAddDialogOpen(false);
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "회원 참가자 추가 실패",
      });
    } finally {
      setMemberBusy(false);
    }
  };

  const handleAddGuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuestBusy(true);
    setStatus(null);
    try {
      const guestProfile = await createManualGuestProfile(clubId, {
        displayName: guestName,
        gender: guestGender || undefined,
        careerText: guestCareerText || undefined,
        groupCode: guestGroupCode || null,
        operatorNote: guestOperatorNote || undefined,
      });

      await addGuestParticipant(eventId, {
        guestProfileId: guestProfile.id,
        arrivalTime: toArrivalTimestamp(guestArrivalTime),
      });

      setStatus({ type: "success", message: "수동 게스트를 추가했습니다." });
      setGuestName("");
      setGuestGender("");
      setGuestCareerText("");
      setGuestGroupCode("");
      setGuestOperatorNote("");
      setGuestArrivalTime("");
      setAddDialogOpen(false);
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "수동 게스트 추가 실패",
      });
    } finally {
      setGuestBusy(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    setRemovingParticipantId(participantId);
    setStatus(null);
    try {
      await removeParticipant(eventId, participantId);
      setStatus({
        type: "success",
        message: "참가자를 삭제했습니다. 확정 경기가 포함된 참가자는 삭제할 수 없습니다.",
      });
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "참가자 삭제 실패",
      });
    } finally {
      setRemovingParticipantId(null);
    }
  };

  const openArrivalEdit = (participant: ClubRecordEventParticipant) => {
    setArrivalEditTarget(participant);
    setArrivalEditTime(isoToHHmm(participant.arrivalTime));
  };

  const closeArrivalEdit = () => {
    if (arrivalEditBusy) return;
    setArrivalEditTarget(null);
    setArrivalEditTime("");
  };

  const handleSaveArrivalEdit = async () => {
    if (!arrivalEditTarget) return;
    setArrivalEditBusy(true);
    setStatus(null);
    try {
      const next = arrivalEditTime ? toArrivalTimestamp(arrivalEditTime) : null;
      await updateParticipantArrivalTime(arrivalEditTarget.id, next);
      setStatus({
        type: "success",
        message: arrivalEditTime
          ? `${arrivalEditTarget.displayName} 님 도착 시간을 ${arrivalEditTime}(으)로 변경했습니다.`
          : `${arrivalEditTarget.displayName} 님을 정시 참가로 변경했습니다.`,
      });
      setArrivalEditTarget(null);
      setArrivalEditTime("");
      await onChanged();
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "도착 시간 변경에 실패했습니다.",
      });
    } finally {
      setArrivalEditBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      {status ? <StatusBox type={status.type} message={status.message} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>참가자</CardTitle>
              <p className="text-sm text-muted-foreground">
                {readOnly
                  ? "지난 이벤트에 참가했던 회원과 게스트입니다."
                  : "현재 이벤트에 참가 중인 회원과 게스트입니다."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="default">{participants.length}명</Badge>
              {!readOnly ? (
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <UserPlus className="size-4" />
                  참가자 추가
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {participants.length > 0 ? (
            participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{participant.displayName}</p>
                    <Badge variant={participant.participantType === "guest" ? "warning" : "brand"}>
                      {participant.participantType === "guest" ? "게스트" : "회원"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatArrivalLabel(participant.arrivalTime)}
                  </p>
                </div>
                {!readOnly ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={removingParticipantId === participant.id}
                      onClick={() => openArrivalEdit(participant)}
                    >
                      <Clock className="size-4" />
                      시간
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={removingParticipantId === participant.id}
                      onClick={() => void handleRemoveParticipant(participant.id)}
                    >
                      <UserRoundMinus className="size-4" />
                      {removingParticipantId === participant.id ? "삭제 중..." : "삭제"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 size-5" />
              아직 등록된 참가자가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="참가자 추가"
        description="클럽 회원 또는 현장 게스트를 이벤트 참가자로 추가합니다."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 rounded-lg border bg-muted/20 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                addTab === "members"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setAddTab("members")}
            >
              클럽 회원
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                addTab === "guest"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setAddTab("guest")}
            >
              게스트
            </button>
          </div>

          {addTab === "members" ? (
            <form className="space-y-4" onSubmit={handleAddMembers}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {selectedClubMemberIds.length}명 선택됨
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={availableMembers.length === 0}
                    onClick={() => setSelectedClubMemberIds(availableMembers.map((item) => item.id))}
                  >
                    전체 선택
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={selectedClubMemberIds.length === 0}
                    onClick={() => setSelectedClubMemberIds([])}
                  >
                    해제
                  </Button>
                </div>
              </div>

              {loadingMembers ? (
                <LoadingSpinner title="멤버 로딩 중" message="클럽 멤버 목록을 불러오는 중..." />
              ) : availableMembers.length > 0 ? (
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {availableMembers.map((member) => {
                    const selected = selectedClubMemberIdSet.has(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                          selected
                            ? "border-[var(--brand)] bg-[var(--brand)]/5"
                            : "bg-background hover:bg-muted/30"
                        }`}
                        onClick={() => toggleSelectedClubMember(member.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {member.nickname}
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="default">
                              {memberRoleLabels[member.role]}
                            </Badge>
                            {member.isMe ? "내 계정" : "미참가"}
                          </span>
                        </span>
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                              : "bg-background"
                          }`}
                        >
                          {selected ? <Check className="size-4" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  추가할 수 있는 미참가 회원이 없습니다.
                </div>
              )}

              <div className="grid gap-2">
                <Label>늦참 시간</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={memberArrivalTime === "" ? "default" : "outline"}
                    onClick={() => setMemberArrivalTime("")}
                  >
                    정시
                  </Button>
                  {arrivalOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={memberArrivalTime === option ? "default" : "outline"}
                      onClick={() => setMemberArrivalTime(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={memberBusy || selectedClubMemberIds.length === 0}
              >
                <UserPlus className="size-4" />
                {memberBusy ? "추가 중..." : "선택한 회원 추가"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleAddGuest}>
              <div className="grid gap-2">
                <Label htmlFor="club-record-guest-name">이름</Label>
                <Input
                  id="club-record-guest-name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="게스트 이름"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>성별</Label>
                  {/*
                    자동 편성의 여복/혼복 룰은 DB 의 `gender` 컬럼이 정확히
                    'male' | 'female' | 'unspecified' enum 값일 때만 동작한다.
                    예전엔 자유 텍스트 입력이라 운영진이 "남성"/"여성" 같은
                    한국어를 넣어 알고리즘이 매치하지 못했다(여복 룰 미발동).
                    토글 버튼으로 enum 을 직접 선택하게 했다.
                  */}
                  <div className="flex gap-1.5">
                    {(
                      [
                        { value: "", label: "미지정" },
                        { value: "male", label: "남성" },
                        { value: "female", label: "여성" },
                      ] as const
                    ).map((option) => (
                      <Button
                        key={option.value || "none"}
                        type="button"
                        size="sm"
                        variant={guestGender === option.value ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setGuestGender(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>그룹</Label>
                  <div className="flex gap-1.5">
                    {(["", "A", "B", "C"] as const).map((code) => (
                      <Button
                        key={code || "none"}
                        type="button"
                        size="sm"
                        variant={guestGroupCode === code ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setGuestGroupCode(code as "" | ClubRecordGroupCode)}
                      >
                        {code || "미지정"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="club-record-guest-career">구력</Label>
                  <Input
                    id="club-record-guest-career"
                    value={guestCareerText}
                    onChange={(event) => setGuestCareerText(event.target.value)}
                    placeholder="예: 2년"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>늦참 시간</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={guestArrivalTime === "" ? "default" : "outline"}
                      onClick={() => setGuestArrivalTime("")}
                    >
                      정시
                    </Button>
                    {arrivalOptions.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={guestArrivalTime === option ? "default" : "outline"}
                        onClick={() => setGuestArrivalTime(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="club-record-guest-note">운영 메모</Label>
                <Textarea
                  id="club-record-guest-note"
                  value={guestOperatorNote}
                  onChange={(event) => setGuestOperatorNote(event.target.value)}
                  placeholder="게스트 메모"
                />
              </div>
              <Button type="submit" className="w-full" disabled={guestBusy}>
                <UserPlus className="size-4" />
                {guestBusy ? "추가 중..." : "게스트 추가"}
              </Button>
            </form>
          )}
        </div>
      </Modal>

      <Modal
        open={arrivalEditTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeArrivalEdit();
        }}
        title="도착 시간 변경"
        description={
          arrivalEditTarget
            ? `${arrivalEditTarget.displayName} 님의 도착 시간을 변경합니다. 변경 후에는 자동 편성을 다시 실행해주세요.`
            : ""
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Button
              type="button"
              variant={arrivalEditTime === "" ? "default" : "outline"}
              disabled={arrivalEditBusy}
              onClick={() => setArrivalEditTime("")}
            >
              정시
            </Button>
            {arrivalOptions.map((option) => (
              <Button
                key={option}
                type="button"
                variant={arrivalEditTime === option ? "default" : "outline"}
                disabled={arrivalEditBusy}
                onClick={() => setArrivalEditTime(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={arrivalEditBusy}
              onClick={closeArrivalEdit}
            >
              취소
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={arrivalEditBusy}
              onClick={() => void handleSaveArrivalEdit()}
            >
              <Check className="size-4" />
              {arrivalEditBusy ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
