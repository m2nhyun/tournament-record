"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getClubDetail,
  listClubMembers,
  updateClubName,
  updateMyClubNickname,
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
    [clubId, refresh],
  );

  const saveMyNickname = useCallback(
    async (nickname: string) => {
      setSaving(true);
      try {
        await updateMyClubNickname(clubId, nickname);
        setStatus({ type: "success", message: "내 닉네임이 변경되었습니다." });
        await refresh();
      } catch (error) {
        setStatus({ type: "error", message: toMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [clubId, refresh],
  );

  return {
    club,
    members,
    loading,
    status,
    saving,
    refresh,
    saveClubName,
    saveMyNickname,
  };
}
