"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getClubDetail,
  listClubMembers,
  regenerateClubInviteCode,
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
        await refresh();
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [clubId, refresh, saving],
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
        await refresh();
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [clubId, refresh, saving],
  );

  const regenerateInviteCode = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await regenerateClubInviteCode(clubId, 30);
      setStatus({
        type: "success",
        message: "초대 코드가 재발급되었습니다. (30일 유효)",
      });
      await refresh();
    } catch (error) {
      setStatus({ type: "error", message: toMessage(error) });
    } finally {
      setSaving(false);
    }
  }, [clubId, refresh, saving]);

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
  };
}
