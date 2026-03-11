"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getClubDetail,
  listClubMembers,
  regenerateClubInviteCode,
  removeClubMember,
  updateClubName,
  updateMyClubMemberSettings,
} from "@/features/clubs/services/clubs";
import type { ClubDetail, ClubMember } from "@/features/clubs/types/club";

type StatusState = {
  type: "info" | "success" | "error";
  message: string;
};

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function useClubDetail(clubId: string) {
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const [clubData, memberData] = await Promise.all([
        getClubDetail(clubId),
        listClubMembers(clubId),
      ]);
      setClub(clubData);
      setMembers(memberData);
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveClubName = useCallback(
    async (name: string) => {
      if (saving) return;
      setSaving(true);
      try {
        await updateClubName(clubId, name);
        setStatus({ type: "success", message: "클럽 이름이 변경되었습니다." });
        setClub((prev) => (prev ? { ...prev, name: name.trim() } : prev));
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [clubId, saving],
  );

  const saveMySettings = useCallback(
    async (input: {
      nickname: string;
      openKakaoProfile: boolean;
      allowRecordSearch: boolean;
      shareHistory: boolean;
    }) => {
      if (saving) return;
      setSaving(true);
      try {
        await updateMyClubMemberSettings(clubId, input);
        setStatus({ type: "success", message: "내 멤버 설정이 변경되었습니다." });
        setClub((prev) =>
          prev ? { ...prev, myNickname: input.nickname.trim() } : prev,
        );
        setMembers((prev) =>
          prev.map((member) =>
            member.isMe
              ? {
                  ...member,
                  nickname: input.nickname.trim(),
                  openKakaoProfile: input.openKakaoProfile,
                  allowRecordSearch: input.allowRecordSearch,
                  shareHistory: input.shareHistory,
                }
              : member,
          ),
        );
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [clubId, saving],
  );

  const regenerateInviteCode = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const nextInvite = await regenerateClubInviteCode(clubId, 30);
      setStatus({
        type: "success",
        message: "초대 코드가 재발급되었습니다. (30일 유효)",
      });
      setClub((prev) =>
        prev
          ? {
              ...prev,
              inviteCode: nextInvite.inviteCode,
              inviteExpiresAt: nextInvite.inviteExpiresAt,
            }
          : prev,
      );
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setSaving(false);
    }
  }, [clubId, saving]);

  const removeMember = useCallback(
    async (memberId: string) => {
      if (saving) return;
      setSaving(true);
      try {
        await removeClubMember(clubId, memberId);
        setStatus({ type: "success", message: "멤버를 클럽에서 제외했습니다." });
        setMembers((prev) => prev.filter((member) => member.id !== memberId));
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [clubId, saving],
  );

  return {
    club,
    members,
    loading,
    status,
    saving,
    refresh,
    saveClubName,
    saveMySettings,
    regenerateInviteCode,
    removeMember,
  };
}
