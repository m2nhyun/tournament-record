import { requireUser } from "@/features/auth/services/auth";
import { requireCompletedProfile } from "@/features/auth/services/profile";
import { getSupabaseClient } from "@/lib/supabase/client";
import { mapScheduleError } from "@/features/schedules/services/schedule-error";

import type {
  MatchScheduleCreationData,
  MatchScheduleDetail,
  MatchScheduleParticipant,
  MatchScheduleSummary,
} from "@/features/schedules/types/schedule";

type ScheduleRow = {
  id: string;
  club_id: string;
  host_member_id: string;
  format: MatchScheduleSummary["format"];
  status: MatchScheduleSummary["status"];
  linked_match_id: string | null;
  scheduled_at: string;
  ends_at: string;
  location: string;
  court_fee: number;
  ball_fee: number;
  capacity: number;
  notes: string;
  host_member:
    | { id: string; nickname: string; user_id: string | null }
    | { id: string; nickname: string; user_id: string | null }[]
    | null;
};

type ParticipantRow = {
  schedule_id: string;
  club_member_id: string;
  created_at: string;
  member:
    | { id: string; nickname: string; user_id: string | null }
    | { id: string; nickname: string; user_id: string | null }[]
    | null;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toScheduleSummary(
  row: ScheduleRow,
  participantMap: Map<string, MatchScheduleParticipant[]>,
): MatchScheduleSummary {
  const host = pickOne(row.host_member);
  const participantsForSchedule = (participantMap.get(row.id) ?? []).map(
    (participant) => ({
      ...participant,
      isHost: participant.clubMemberId === row.host_member_id,
    }),
  );
  const participantCount = participantsForSchedule.length;
  const hostParticipates = participantsForSchedule.some(
    (participant) => participant.clubMemberId === row.host_member_id,
  );

  return {
    id: row.id,
    clubId: row.club_id,
    format: row.format,
    status: row.status,
    scheduledAt: row.scheduled_at,
    endsAt: row.ends_at,
    location: row.location,
    courtFee: row.court_fee,
    ballFee: row.ball_fee,
    capacity: row.capacity,
    notes: row.notes,
    hostMemberId: row.host_member_id,
    hostNickname: host?.nickname ?? "알 수 없음",
    hostParticipates,
    participantCount,
    remainingSlots: Math.max(0, row.capacity - participantCount),
    isHost: false,
    isParticipant: participantsForSchedule.some((participant) => participant.isMe),
    participants: participantsForSchedule,
  } satisfies MatchScheduleSummary;
}

export async function createMatchSchedule(
  clubId: string,
  data: MatchScheduleCreationData,
): Promise<string> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error(
      "게스트는 일정을 만들 수 없습니다. 카카오/이메일 로그인 후 이용해주세요.",
    );
  }
  await requireCompletedProfile();

  const { data: scheduleId, error } = await getSupabaseClient().rpc(
    "create_match_schedule",
    {
      p_club_id: clubId,
      p_format: data.format,
      p_scheduled_at: data.scheduledAt,
      p_ends_at: data.endsAt,
      p_location: data.location.trim(),
      p_court_fee: data.courtFee,
      p_ball_fee: data.ballFee,
      p_capacity: data.capacity,
      p_include_host: data.includeHost,
      p_notes: data.notes.trim(),
    },
  );

  if (error) throw mapScheduleError(error);
  return String(scheduleId);
}

export async function joinMatchSchedule(scheduleId: string) {
  await requireUser();

  const { error } = await getSupabaseClient().rpc("join_match_schedule", {
    p_schedule_id: scheduleId,
  });

  if (error) throw mapScheduleError(error);
}

export async function leaveMatchSchedule(scheduleId: string) {
  await requireUser();

  const { error } = await getSupabaseClient().rpc("leave_match_schedule", {
    p_schedule_id: scheduleId,
  });

  if (error) throw mapScheduleError(error);
}

export async function listUpcomingMatchSchedules(
  clubId: string,
): Promise<MatchScheduleSummary[]> {
  const user = await requireUser();
  const supabase = getSupabaseClient();

  const { data: schedules, error: scheduleError } = await supabase
    .from("match_schedules")
    .select(
      `
      id,
      club_id,
      host_member_id,
      format,
      status,
      linked_match_id,
      scheduled_at,
      ends_at,
      location,
      court_fee,
      ball_fee,
      capacity,
      notes,
      host_member:club_members!match_schedules_host_member_id_fkey(id,nickname,user_id)
    `,
    )
    .eq("club_id", clubId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(8);

  if (scheduleError) throw mapScheduleError(scheduleError);

  const scheduleRows = (schedules ?? []) as ScheduleRow[];
  const scheduleIds = scheduleRows.map((schedule) => schedule.id);

  if (scheduleIds.length === 0) return [];

  const { data: participants, error: participantError } = await supabase
    .from("match_schedule_participants")
    .select(
      `
      schedule_id,
      club_member_id,
      created_at,
      member:club_members!match_schedule_participants_club_member_id_fkey(id,nickname,user_id)
    `,
    )
    .in("schedule_id", scheduleIds)
    .order("created_at", { ascending: true });

  if (participantError) throw mapScheduleError(participantError);

  const participantMap = new Map<string, MatchScheduleParticipant[]>();

  ((participants ?? []) as ParticipantRow[]).forEach((row) => {
    const member = pickOne(row.member);
    if (!member) return;

    const nextParticipant: MatchScheduleParticipant = {
      clubMemberId: row.club_member_id,
      nickname: member.nickname,
      joinedAt: row.created_at,
      isHost: false,
      isMe: member.user_id === user.id,
    };

    const group = participantMap.get(row.schedule_id) ?? [];
    group.push(nextParticipant);
    participantMap.set(row.schedule_id, group);
  });

  return scheduleRows.map((row) => {
    const summary = toScheduleSummary(row, participantMap);
    return {
      ...summary,
      isHost: pickOne(row.host_member)?.user_id === user.id,
    };
  });
}

export async function getMatchScheduleDetail(
  clubId: string,
  scheduleId: string,
): Promise<MatchScheduleDetail> {
  const user = await requireUser();
  const supabase = getSupabaseClient();

  const { data: schedule, error: scheduleError } = await supabase
    .from("match_schedules")
    .select(
      `
      id,
      club_id,
      host_member_id,
      format,
      status,
      linked_match_id,
      scheduled_at,
      ends_at,
      location,
      court_fee,
      ball_fee,
      capacity,
      notes,
      host_member:club_members!match_schedules_host_member_id_fkey(id,nickname,user_id)
    `,
    )
    .eq("id", scheduleId)
    .eq("club_id", clubId)
    .single();

  if (scheduleError || !schedule) {
    throw mapScheduleError(scheduleError ?? new Error("일정을 찾을 수 없습니다."));
  }

  const { data: participants, error: participantError } = await supabase
    .from("match_schedule_participants")
    .select(
      `
      schedule_id,
      club_member_id,
      created_at,
      member:club_members!match_schedule_participants_club_member_id_fkey(id,nickname,user_id)
    `,
    )
    .eq("schedule_id", scheduleId)
    .order("created_at", { ascending: true });

  if (participantError) throw mapScheduleError(participantError);

  const participantMap = new Map<string, MatchScheduleParticipant[]>();

  ((participants ?? []) as ParticipantRow[]).forEach((row) => {
    const member = pickOne(row.member);
    if (!member) return;

    const nextParticipant: MatchScheduleParticipant = {
      clubMemberId: row.club_member_id,
      nickname: member.nickname,
      joinedAt: row.created_at,
      isHost: false,
      isMe: member.user_id === user.id,
    };

    const group = participantMap.get(row.schedule_id) ?? [];
    group.push(nextParticipant);
    participantMap.set(row.schedule_id, group);
  });

  const summary = toScheduleSummary(schedule as ScheduleRow, participantMap);
  const totalFee = summary.courtFee + summary.ballFee;
  const estimatedFeePerPerson =
    summary.capacity > 0 ? Math.ceil(totalFee / summary.capacity) : 0;

  return {
    ...summary,
    isHost: pickOne((schedule as ScheduleRow).host_member)?.user_id === user.id,
    linkedMatchId: (schedule as ScheduleRow).linked_match_id,
    estimatedFeePerPerson,
  };
}
