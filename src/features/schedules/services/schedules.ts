import { requireCompletedProfile } from "@/features/auth/services/profile";
import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { mapScheduleError } from "@/features/schedules/services/schedule-error";

import type {
  MatchScheduleCreationData,
  MatchScheduleDetail,
  MatchScheduleParticipant,
  MatchScheduleRequest,
  MatchScheduleRequestStatus,
  MatchScheduleSummary,
} from "@/features/schedules/types/schedule";

type ScheduleRow = {
  id: string;
  club_id: string;
  host_member_id: string;
  format: MatchScheduleSummary["format"];
  status: MatchScheduleSummary["status"];
  join_policy: MatchScheduleSummary["joinPolicy"];
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

type RequestRow = {
  schedule_id: string;
  club_member_id: string;
  status: MatchScheduleRequestStatus;
  message: string;
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

function buildParticipantMap(rows: ParticipantRow[], userId: string) {
  const participantMap = new Map<string, MatchScheduleParticipant[]>();

  rows.forEach((row) => {
    const member = pickOne(row.member);
    if (!member) return;

    const nextParticipant: MatchScheduleParticipant = {
      clubMemberId: row.club_member_id,
      nickname: member.nickname,
      joinedAt: row.created_at,
      isHost: false,
      isMe: member.user_id === userId,
    };

    const group = participantMap.get(row.schedule_id) ?? [];
    group.push(nextParticipant);
    participantMap.set(row.schedule_id, group);
  });

  return participantMap;
}

function buildRequestMap(rows: RequestRow[], userId: string) {
  const requestMap = new Map<string, MatchScheduleRequest[]>();

  rows.forEach((row) => {
    const member = pickOne(row.member);
    if (!member) return;

    const nextRequest: MatchScheduleRequest = {
      clubMemberId: row.club_member_id,
      nickname: member.nickname,
      requestedAt: row.created_at,
      status: row.status,
      message: row.message,
      isMe: member.user_id === userId,
    };

    const group = requestMap.get(row.schedule_id) ?? [];
    group.push(nextRequest);
    requestMap.set(row.schedule_id, group);
  });

  return requestMap;
}

function toScheduleSummary(
  row: ScheduleRow,
  participantMap: Map<string, MatchScheduleParticipant[]>,
  requestMap: Map<string, MatchScheduleRequest[]>,
): MatchScheduleSummary {
  const host = pickOne(row.host_member);
  const participantsForSchedule = (participantMap.get(row.id) ?? []).map(
    (participant) => ({
      ...participant,
      isHost: participant.clubMemberId === row.host_member_id,
    }),
  );
  const requestsForSchedule = requestMap.get(row.id) ?? [];
  const participantCount = participantsForSchedule.length;
  const hostParticipates = participantsForSchedule.some(
    (participant) => participant.clubMemberId === row.host_member_id,
  );
  const myRequest =
    requestsForSchedule.find((request) => request.isMe) ?? null;

  return {
    id: row.id,
    clubId: row.club_id,
    format: row.format,
    status: row.status,
    joinPolicy: row.join_policy,
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
    myRequestStatus: myRequest?.status ?? null,
    requestCount: requestsForSchedule.filter((request) => request.status === "pending")
      .length,
    participants: participantsForSchedule,
  } satisfies MatchScheduleSummary;
}

async function listScheduleParticipants(
  scheduleIds: string[],
  userId: string,
) {
  if (scheduleIds.length === 0) return new Map<string, MatchScheduleParticipant[]>();

  const { data: participants, error } = await getSupabaseClient()
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

  if (error) throw mapScheduleError(error);

  return buildParticipantMap((participants ?? []) as ParticipantRow[], userId);
}

async function listScheduleRequests(scheduleIds: string[], userId: string) {
  if (scheduleIds.length === 0) return new Map<string, MatchScheduleRequest[]>();

  const { data: requests, error } = await getSupabaseClient()
    .from("match_schedule_requests")
    .select(
      `
      schedule_id,
      club_member_id,
      status,
      message,
      created_at,
      member:club_members!match_schedule_requests_club_member_id_fkey(id,nickname,user_id)
    `,
    )
    .in("schedule_id", scheduleIds)
    .order("created_at", { ascending: true });

  if (error) throw mapScheduleError(error);

  return buildRequestMap((requests ?? []) as RequestRow[], userId);
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
      p_join_policy: data.joinPolicy,
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

export async function requestMatchSchedule(scheduleId: string, message = "") {
  await requireCompletedProfile();

  const { error } = await getSupabaseClient().rpc("request_match_schedule", {
    p_schedule_id: scheduleId,
    p_message: message.trim(),
  });

  if (error) throw mapScheduleError(error);
}

export async function cancelMatchScheduleRequest(scheduleId: string) {
  await requireCompletedProfile();

  const { error } = await getSupabaseClient().rpc(
    "cancel_match_schedule_request",
    {
      p_schedule_id: scheduleId,
    },
  );

  if (error) throw mapScheduleError(error);
}

export async function acceptMatchScheduleRequest(
  scheduleId: string,
  clubMemberId: string,
) {
  await requireCompletedProfile();

  const { error } = await getSupabaseClient().rpc(
    "accept_match_schedule_request",
    {
      p_schedule_id: scheduleId,
      p_club_member_id: clubMemberId,
    },
  );

  if (error) throw mapScheduleError(error);
}

export async function rejectMatchScheduleRequest(
  scheduleId: string,
  clubMemberId: string,
) {
  await requireCompletedProfile();

  const { error } = await getSupabaseClient().rpc(
    "reject_match_schedule_request",
    {
      p_schedule_id: scheduleId,
      p_club_member_id: clubMemberId,
    },
  );

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
      join_policy,
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

  const participantMap = await listScheduleParticipants(scheduleIds, user.id);
  const requestMap = await listScheduleRequests(scheduleIds, user.id);

  return scheduleRows.map((row) => {
    const summary = toScheduleSummary(row, participantMap, requestMap);
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
      join_policy,
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

  const participantMap = await listScheduleParticipants([scheduleId], user.id);
  const requestMap = await listScheduleRequests([scheduleId], user.id);
  const summary = toScheduleSummary(
    schedule as ScheduleRow,
    participantMap,
    requestMap,
  );
  const totalFee = summary.courtFee + summary.ballFee;
  const estimatedFeePerPerson =
    summary.capacity > 0 ? Math.ceil(totalFee / summary.capacity) : 0;

  return {
    ...summary,
    isHost: pickOne((schedule as ScheduleRow).host_member)?.user_id === user.id,
    linkedMatchId: (schedule as ScheduleRow).linked_match_id,
    estimatedFeePerPerson,
    pendingRequests: (requestMap.get(scheduleId) ?? []).filter(
      (request) => request.status === "pending",
    ),
  };
}
