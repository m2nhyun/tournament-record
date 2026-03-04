"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getClubDetail,
  listClubMembers,
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

  return { club, members, loading, status, refresh };
}
