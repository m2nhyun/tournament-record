import { requireCompletedProfile } from "@/features/auth/services/profile";
import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordEvent,
  ClubRecordEventCreateInput,
  ClubRecordEventUpdateInput,
} from "@/features/club-record/types/event";
import { mapClubRecordError } from "@/features/club-record/services/errors";
import { buildClubRecordEventSlots } from "@/features/club-record/utils/slots";

type EventRow = {
  id: string;
  club_id: string;
  title: string | null;
  event_date: string;
  starts_at: string;
  ends_at: string;
  court_count: number;
  status: ClubRecordEvent["status"];
  assignment_dirty: boolean;
  last_assignment_run_at: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

function toClubRecordEvent(row: EventRow): ClubRecordEvent {
  return {
    id: row.id,
    clubId: row.club_id,
    title: row.title,
    eventDate: row.event_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    courtCount: row.court_count,
    status: row.status,
    assignmentDirty: row.assignment_dirty,
    lastAssignmentRunAt: row.last_assignment_run_at,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isSameTimestamp(left: string, right: string) {
  return new Date(left).getTime() === new Date(right).getTime();
}

async function createEventSlots(
  eventId: string,
  input: Pick<ClubRecordEventCreateInput, "startsAt" | "endsAt" | "courtCount">,
) {
  const slots = buildClubRecordEventSlots({
    eventId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    courtCount: input.courtCount,
  });

  if (slots.length === 0) {
    throw new Error("생성할 이벤트 슬롯이 없습니다.");
  }

  const { error } = await getSupabaseClient()
    .from("club_record_event_slots")
    .insert(slots);

  if (error) throw mapClubRecordError(error);
}

async function hasConfirmedClubRecordMatch(eventId: string): Promise<boolean> {
  const { count, error } = await getSupabaseClient()
    .from("club_record_matches")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if (error) throw mapClubRecordError(error);

  return (count ?? 0) > 0;
}

export async function getClubRecordEvents(
  clubId: string,
): Promise<ClubRecordEvent[]> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_record_events")
    .select(
      "id,club_id,title,event_date,starts_at,ends_at,court_count,status,assignment_dirty,last_assignment_run_at,is_deleted,created_at,updated_at",
    )
    .eq("club_id", clubId)
    .eq("is_deleted", false)
    .order("event_date", { ascending: false })
    .order("starts_at", { ascending: true });

  if (error) throw mapClubRecordError(error);

  return ((data ?? []) as EventRow[]).map(toClubRecordEvent);
}

export async function getClubRecordEvent(
  eventId: string,
): Promise<ClubRecordEvent> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_record_events")
    .select(
      "id,club_id,title,event_date,starts_at,ends_at,court_count,status,assignment_dirty,last_assignment_run_at,is_deleted,created_at,updated_at",
    )
    .eq("id", eventId)
    .single();

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("club record 이벤트를 찾을 수 없습니다."));
  }

  return toClubRecordEvent(data as EventRow);
}

export async function createClubRecordEvent(
  clubId: string,
  input: ClubRecordEventCreateInput,
): Promise<string> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error("게스트는 club record 이벤트를 생성할 수 없습니다.");
  }
  await requireCompletedProfile();

  const client = getSupabaseClient();

  const { data, error } = await client
    .from("club_record_events")
    .insert({
      club_id: clubId,
      title: input.title?.trim() || null,
      event_date: input.eventDate,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      court_count: input.courtCount,
      status: "draft",
      assignment_dirty: false,
      last_assignment_run_at: null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("club record 이벤트 생성 실패"));
  }

  const eventId = String(data.id);

  try {
    await createEventSlots(eventId, input);
    await client.rpc("refresh_club_record_progress_for_event", {
      p_event_id: eventId,
    });
  } catch (error) {
    await client.from("club_record_events").delete().eq("id", eventId);
    throw error;
  }

  return eventId;
}

export async function updateClubRecordEvent(
  eventId: string,
  input: ClubRecordEventUpdateInput,
): Promise<void> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error("게스트는 club record 이벤트를 수정할 수 없습니다.");
  }

  const client = getSupabaseClient();

  const { data: existingEvent, error: existingEventError } = await client
    .from("club_record_events")
    .select(
      "id,title,event_date,starts_at,ends_at,court_count,status,assignment_dirty,last_assignment_run_at,is_deleted,club_id,created_at,updated_at",
    )
    .eq("id", eventId)
    .single();

  if (existingEventError || !existingEvent) {
    throw mapClubRecordError(
      existingEventError ?? new Error("수정할 club record 이벤트를 찾을 수 없습니다."),
    );
  }

  const payload: Record<string, unknown> = {
    updated_by: user.id,
  };

  if ("title" in input) payload.title = input.title?.trim() || null;
  if ("eventDate" in input && input.eventDate) payload.event_date = input.eventDate;
  if ("startsAt" in input && input.startsAt) payload.starts_at = input.startsAt;
  if ("endsAt" in input && input.endsAt) payload.ends_at = input.endsAt;
  if ("courtCount" in input && typeof input.courtCount === "number") {
    payload.court_count = input.courtCount;
  }

  const nextEventDate = input.eventDate ?? String(existingEvent.event_date);
  const nextStartsAt = input.startsAt ?? String(existingEvent.starts_at);
  const nextEndsAt = input.endsAt ?? String(existingEvent.ends_at);
  const nextCourtCount =
    typeof input.courtCount === "number"
      ? input.courtCount
      : Number(existingEvent.court_count);

  const isSchedulingChanged =
    nextEventDate !== String(existingEvent.event_date) ||
    !isSameTimestamp(nextStartsAt, String(existingEvent.starts_at)) ||
    !isSameTimestamp(nextEndsAt, String(existingEvent.ends_at)) ||
    nextCourtCount !== Number(existingEvent.court_count);

  if (isSchedulingChanged) {
    if (await hasConfirmedClubRecordMatch(eventId)) {
      throw new Error("확정된 경기가 있는 이벤트는 시간/코트 정보를 변경할 수 없습니다.");
    }

    payload.status = "draft";
    payload.assignment_dirty = false;
    payload.last_assignment_run_at = null;
  }

  const { error } = await client
    .from("club_record_events")
    .update(payload)
    .eq("id", eventId);

  if (error) throw mapClubRecordError(error);

  if (!isSchedulingChanged) return;

  const { error: deleteSlotsError } = await client
    .from("club_record_event_slots")
    .delete()
    .eq("event_id", eventId);

  if (deleteSlotsError) throw mapClubRecordError(deleteSlotsError);

  const { error: deleteParticipantsError } = await client
    .from("club_record_event_participants")
    .delete()
    .eq("event_id", eventId);

  if (deleteParticipantsError) throw mapClubRecordError(deleteParticipantsError);

  await createEventSlots(eventId, {
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    courtCount: nextCourtCount,
  });

  const { error: resetAssignmentStateError } = await client
    .from("club_record_events")
    .update({
      assignment_dirty: false,
      last_assignment_run_at: null,
      status: "draft",
      updated_by: user.id,
    })
    .eq("id", eventId);

  if (resetAssignmentStateError) {
    throw mapClubRecordError(resetAssignmentStateError);
  }

  await client.rpc("refresh_club_record_progress_for_event", {
    p_event_id: eventId,
  });
}

export async function archiveClubRecordEvent(eventId: string): Promise<void> {
  const user = await requireUser();
  if (user.is_anonymous) {
    throw new Error("게스트는 club record 이벤트를 삭제할 수 없습니다.");
  }

  if (await hasConfirmedClubRecordMatch(eventId)) {
    throw new Error("확정된 경기가 있는 이벤트는 삭제할 수 없습니다.");
  }

  const { error } = await getSupabaseClient()
    .from("club_record_events")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_by: user.id,
      status: "cancelled",
    })
    .eq("id", eventId);

  if (error) throw mapClubRecordError(error);
}
