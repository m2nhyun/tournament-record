"use client";

import { useCallback, useEffect, useState } from "react";

import { toClubRecordErrorMessage } from "@/features/club-record/services/errors";
import {
  getClubRanking,
  moveRankingPosition,
  syncClubRecordMembers,
} from "@/features/club-record/services/ranking";
import type {
  ClubRecordMember,
  ClubRecordRankingMoveInput,
} from "@/features/club-record/types/member";

function applyReorder(
  members: ClubRecordMember[],
  fromIndex: number,
  toIndex: number,
): ClubRecordMember[] {
  if (fromIndex === toIndex) return members;
  if (fromIndex < 0 || fromIndex >= members.length) return members;
  if (toIndex < 0 || toIndex >= members.length) return members;

  const next = members.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((member, index) => ({
    ...member,
    rankingPosition: index + 1,
  }));
}

export function useClubRanking(clubId: string, enabled = true) {
  const [members, setMembers] = useState<ClubRecordMember[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getClubRanking(clubId);
      setMembers(data);
    } catch (err) {
      setError(toClubRecordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId, enabled]);

  // 위/아래 버튼/드래그 모두 공통으로 쓰는 reorder. 클라이언트 상태를 먼저
  // 옮기고 RPC를 백그라운드로 호출한다. 실패 시 직전 상태로 rollback.
  // refresh()를 호출하지 않아 다른 행 리렌더링이 발생하지 않는다.
  const reorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      let snapshot: ClubRecordMember[] = [];
      let movedMember: ClubRecordMember | null = null;
      let targetPosition = toIndex + 1;

      setMembers((current) => {
        snapshot = current;
        if (fromIndex < 0 || fromIndex >= current.length) return current;
        if (toIndex < 0 || toIndex >= current.length) return current;
        movedMember = current[fromIndex] ?? null;
        targetPosition = toIndex + 1;
        return applyReorder(current, fromIndex, toIndex);
      });

      if (!movedMember || fromIndex === toIndex) return;

      try {
        await moveRankingPosition(clubId, {
          clubMemberId: (movedMember as ClubRecordMember).clubMemberId,
          targetPosition,
        });
      } catch (err) {
        setMembers(snapshot);
        throw err;
      }
    },
    [clubId],
  );

  const move = useCallback(
    async (input: ClubRecordRankingMoveInput) => {
      const fromIndex = members.findIndex(
        (member) => member.clubMemberId === input.clubMemberId,
      );
      if (fromIndex === -1) {
        await moveRankingPosition(clubId, input);
        await refresh();
        return;
      }
      const toIndex = input.targetPosition - 1;
      await reorder(fromIndex, toIndex);
    },
    [clubId, members, refresh, reorder],
  );

  const syncMembers = useCallback(async () => {
    const insertedCount = await syncClubRecordMembers(clubId);
    await refresh();
    return insertedCount;
  }, [clubId, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { members, loading, error, refresh, move, reorder, syncMembers };
}
