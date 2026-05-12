import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordAddGuestParticipantInput,
  ClubRecordAddMemberParticipantInput,
  ClubRecordEventParticipant,
} from "@/features/club-record/types/participant";
import { mapClubRecordError } from "@/features/club-record/services/errors";

type ParticipantRow = {
  id: string;
  event_id: string;
  participant_type: ClubRecordEventParticipant["participantType"];
  club_member_id: string | null;
  guest_profile_id: string | null;
  display_name: string | null;
  arrival_time: string | null;
  attendance_status: ClubRecordEventParticipant["attendanceStatus"];
  group_code: ClubRecordEventParticipant["groupCode"];
  ranking_position: number | null;
};

function toClubRecordParticipant(
  row: ParticipantRow,
): ClubRecordEventParticipant {
  return {
    id: row.id,
    eventId: row.event_id,
    participantType: row.participant_type,
    clubMemberId: row.club_member_id,
    guestProfileId: row.guest_profile_id,
    displayName: row.display_name ?? "이름 없음",
    arrivalTime: row.arrival_time,
    attendanceStatus: row.attendance_status,
    groupCode: row.group_code,
    rankingPosition: row.ranking_position,
  };
}

export async function getClubRecordParticipants(
  eventId: string,
): Promise<ClubRecordEventParticipant[]> {
  await requireUser();

  const { data, error } = await getSupabaseClient().rpc(
    "get_club_record_event_participants",
    {
      p_event_id: eventId,
    },
  );

  if (error) throw mapClubRecordError(error);

  return ((data ?? []) as ParticipantRow[]).map(toClubRecordParticipant);
}

export async function addMemberParticipant(
  eventId: string,
  input: ClubRecordAddMemberParticipantInput,
): Promise<void> {
  const user = await requireUser();

  const { error } = await getSupabaseClient()
    .from("club_record_event_participants")
    .insert({
      event_id: eventId,
      participant_type: "member",
      club_member_id: input.clubMemberId,
      arrival_time: input.arrivalTime ?? null,
      added_by: user.id,
    });

  if (error) throw mapClubRecordError(error);
}

export async function addGuestParticipant(
  eventId: string,
  input: ClubRecordAddGuestParticipantInput,
): Promise<void> {
  const user = await requireUser();

  const { error } = await getSupabaseClient()
    .from("club_record_event_participants")
    .insert({
      event_id: eventId,
      participant_type: "guest",
      guest_profile_id: input.guestProfileId,
      arrival_time: input.arrivalTime ?? null,
      added_by: user.id,
    });

  if (error) throw mapClubRecordError(error);
}

export async function removeParticipant(
  eventId: string,
  participantId: string,
): Promise<void> {
  await requireUser();

  const { error } = await getSupabaseClient().rpc(
    "remove_club_record_event_participant",
    {
      p_event_id: eventId,
      p_participant_id: participantId,
    },
  );

  if (error) throw mapClubRecordError(error);
}
