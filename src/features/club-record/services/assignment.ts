import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordManualMatchInput,
  ClubRecordMatchPlayer,
} from "@/features/club-record/types/match";
import type {
  ClubRecordAssignmentBoard,
  ClubRecordEventSlot,
  ClubRecordEventSlotOverview,
} from "@/features/club-record/types/slot";
import {
  mapClubRecordError,
} from "@/features/club-record/services/errors";
import { getClubRecordParticipants } from "@/features/club-record/services/participants";
import { planClubRecordAutoAssignments } from "@/features/club-record/utils/auto-assignment";
import { buildClubRecordAssignmentBoard } from "@/features/club-record/utils/assignment-board";

type SlotOverviewRow = {
  id: string;
  event_id: string;
  court_number: number;
  slot_order: number;
  starts_at: string;
  ends_at: string;
  status: ClubRecordEventSlot["status"];
  is_locked: boolean;
  match_id: string | null;
  match_status: ClubRecordEventSlotOverview["match"] extends infer T
    ? T extends { status: infer U }
      ? U
      : never
    : never;
  assignment_mode: ClubRecordEventSlotOverview["match"] extends infer T
    ? T extends { assignmentMode: infer U }
      ? U
      : never
    : never;
  is_manual: boolean | null;
  confirmed_at: string | null;
  score_text: string | null;
  player_participant_id: string | null;
  player_display_name: string | null;
  player_side: 1 | 2 | null;
  player_position: 1 | 2 | null;
};

function assertManualMatchPlayers(input: ClubRecordManualMatchInput) {
  if (input.players.length !== 4) {
    throw new Error("수동 경기는 정확히 4명의 참가자가 필요합니다.");
  }

  const uniqueParticipantIds = new Set(input.players.map((player) => player.participantId));
  if (uniqueParticipantIds.size !== 4) {
    throw new Error("같은 참가자를 한 경기에서 중복 선택할 수 없습니다.");
  }

  const side1Count = input.players.filter((player) => player.side === 1).length;
  const side2Count = input.players.filter((player) => player.side === 2).length;
  if (side1Count !== 2 || side2Count !== 2) {
    throw new Error("각 팀은 정확히 2명이어야 합니다.");
  }

  const uniquePositions = new Set(input.players.map((player) => `${player.side}-${player.position}`));
  if (uniquePositions.size !== 4) {
    throw new Error("각 팀의 포지션은 중복될 수 없습니다.");
  }
}

function toBaseSlot(row: SlotOverviewRow): ClubRecordEventSlot {
  return {
    id: row.id,
    eventId: row.event_id,
    courtNumber: row.court_number,
    slotOrder: row.slot_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    isLocked: row.is_locked,
  };
}

function toSlotOverview(rows: SlotOverviewRow[]): ClubRecordEventSlotOverview[] {
  const slotMap = new Map<string, ClubRecordEventSlotOverview>();

  for (const row of rows) {
    const existing = slotMap.get(row.id);
    if (!existing) {
      slotMap.set(row.id, {
        ...toBaseSlot(row),
        match: row.match_id
          ? {
              id: row.match_id,
              status: row.match_status!,
              assignmentMode: row.assignment_mode!,
              isManual: Boolean(row.is_manual),
              confirmedAt: row.confirmed_at,
              scoreText: row.score_text,
              players: [],
            }
          : null,
      });
    }

    const slot = slotMap.get(row.id);
    if (!slot?.match) continue;
    if (!row.player_participant_id || !row.player_display_name || !row.player_side || !row.player_position) {
      continue;
    }

    slot.match.players.push({
      participantId: row.player_participant_id,
      displayName: row.player_display_name,
      side: row.player_side,
      position: row.player_position,
    });
  }

  return Array.from(slotMap.values());
}

type AutoAssignmentPlanPayload = {
  slotId: string;
  players: ClubRecordMatchPlayer[];
};

function stripAutoMatchesFromSlots(
  slots: ClubRecordEventSlotOverview[],
): ClubRecordEventSlotOverview[] {
  return slots.map((slot) => {
    if (slot.match?.assignmentMode !== "auto") return slot;

    return {
      ...slot,
      isLocked: false,
      status: "scheduled",
      match: null,
    };
  });
}

export async function getEventSlots(
  eventId: string,
): Promise<ClubRecordEventSlotOverview[]> {
  await requireUser();

  const { data, error } = await getSupabaseClient().rpc(
    "get_club_record_event_slots_overview",
    {
      p_event_id: eventId,
    },
  );

  if (error) throw mapClubRecordError(error);

  return toSlotOverview((data ?? []) as SlotOverviewRow[]);
}

export async function getEventAssignmentBoard(
  eventId: string,
): Promise<ClubRecordAssignmentBoard> {
  const participants = await getClubRecordParticipants(eventId);
  const slots = await getEventSlots(eventId);

  return buildClubRecordAssignmentBoard(participants, slots);
}

export async function runAutoAssignment(_eventId: string): Promise<void> {
  await requireUser();
  const slots = await getEventSlots(_eventId);

  const hasConfirmedAutoMatch = slots.some(
    (slot) =>
      slot.match?.assignmentMode === "auto" && slot.match.status === "confirmed",
  );

  if (hasConfirmedAutoMatch) {
    throw new Error("이미 결과가 확정된 자동 편성 경기가 있어 재편성할 수 없습니다.");
  }

  const participants = await getClubRecordParticipants(_eventId);
  const planningSlots = stripAutoMatchesFromSlots(slots);
  const plans = planClubRecordAutoAssignments(participants, planningSlots);

  const { error } = await getSupabaseClient().rpc(
    "apply_club_record_auto_assignments",
    {
      p_event_id: _eventId,
      p_plans: plans as AutoAssignmentPlanPayload[],
    },
  );

  if (error) throw mapClubRecordError(error);
}

export async function createManualMatch(
  eventId: string,
  input: ClubRecordManualMatchInput,
): Promise<string> {
  await requireUser();
  assertManualMatchPlayers(input);

  const { data, error } = await getSupabaseClient().rpc(
    "create_club_record_manual_match",
    {
      p_event_id: eventId,
      p_slot_id: input.slotId,
      p_players: input.players,
    },
  );

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("수동 경기 생성 실패"));
  }

  return String(data);
}

export async function deleteMatch(matchId: string): Promise<void> {
  await requireUser();

  const { error } = await getSupabaseClient().rpc(
    "delete_club_record_match",
    {
      p_match_id: matchId,
    },
  );

  if (error) throw mapClubRecordError(error);
}

export async function updateMatchPlayers(
  matchId: string,
  players: ClubRecordMatchPlayer[],
): Promise<void> {
  await requireUser();

  if (players.length !== 4) {
    throw new Error("경기는 정확히 4명의 선수가 필요합니다.");
  }

  const participantIds = new Set(players.map((player) => player.participantId));
  if (participantIds.size !== 4) {
    throw new Error("같은 선수를 두 번 이상 선택할 수 없습니다.");
  }

  const { error } = await getSupabaseClient().rpc(
    "update_club_record_match_players",
    {
      p_match_id: matchId,
      p_players: players,
    },
  );

  if (error) throw mapClubRecordError(error);
}
