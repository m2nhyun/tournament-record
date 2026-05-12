import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordGuestInvite,
  ClubRecordGuestInviteVerification,
  ClubRecordGuestJoinInput,
  ClubRecordGuestJoinResult,
  ClubRecordGuestProfile,
  ClubRecordGuestProfileInput,
} from "@/features/club-record/types/guest";
import { mapClubRecordError } from "@/features/club-record/services/errors";

type GuestProfileRow = {
  id: string;
  club_id: string;
  guest_user_id: string | null;
  display_name: string | null;
  gender: string | null;
  career_text: string | null;
  group_code: ClubRecordGuestProfile["groupCode"];
  operator_note: string | null;
  linked_club_member_id: string | null;
};

type GuestInviteRow = {
  id: string;
  club_id: string;
  event_id: string;
  code: string;
  expires_at: string | null;
  is_active: boolean;
};

type GuestInviteVerificationRow = {
  event_id: string;
  club_id: string;
  event_date: string;
  starts_at: string;
  ends_at: string;
};

type GuestJoinRpcRow = GuestInviteVerificationRow & {
  guest_profile_id: string;
  guest_user_id: string | null;
  display_name: string | null;
  gender: string | null;
  career_text: string | null;
  group_code: ClubRecordGuestProfile["groupCode"];
  linked_club_member_id: string | null;
  participant_id: string;
};

function toGuestProfile(row: GuestProfileRow): ClubRecordGuestProfile {
  return {
    id: row.id,
    clubId: row.club_id,
    guestUserId: row.guest_user_id,
    displayName: row.display_name,
    gender: row.gender,
    careerText: row.career_text,
    groupCode: row.group_code,
    operatorNote: row.operator_note,
    linkedClubMemberId: row.linked_club_member_id,
  };
}

function toGuestInvite(row: GuestInviteRow): ClubRecordGuestInvite {
  return {
    id: row.id,
    clubId: row.club_id,
    eventId: row.event_id,
    code: row.code,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  };
}

function toGuestInviteVerification(
  row: GuestInviteVerificationRow,
): ClubRecordGuestInviteVerification {
  return {
    eventId: row.event_id,
    clubId: row.club_id,
    eventDate: row.event_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

function generateGuestInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export async function upsertGuestProfile(
  clubId: string,
  guestUserId: string,
  input: ClubRecordGuestProfileInput,
): Promise<ClubRecordGuestProfile> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_record_guest_profiles")
    .upsert(
      {
        club_id: clubId,
        guest_user_id: guestUserId,
        display_name: input.displayName?.trim() || null,
        gender: input.gender?.trim() || null,
        career_text: input.careerText?.trim() || null,
        group_code: input.groupCode ?? null,
        operator_note: input.operatorNote?.trim() || null,
      },
      {
        onConflict: "club_id,guest_user_id",
      },
    )
    .select(
      "id,club_id,guest_user_id,display_name,gender,career_text,group_code,operator_note,linked_club_member_id",
    )
    .single();

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("게스트 프로필 저장 실패"));
  }

  return toGuestProfile(data as GuestProfileRow);
}

export async function createManualGuestProfile(
  clubId: string,
  input: ClubRecordGuestProfileInput,
): Promise<ClubRecordGuestProfile> {
  await requireUser();

  const displayName = input.displayName?.trim();
  if (!displayName) {
    throw new Error("수동 게스트 이름을 입력해주세요.");
  }

  const { data, error } = await getSupabaseClient()
    .from("club_record_guest_profiles")
    .insert({
      club_id: clubId,
      guest_user_id: null,
      display_name: displayName,
      gender: input.gender?.trim() || null,
      career_text: input.careerText?.trim() || null,
      group_code: input.groupCode ?? null,
      operator_note: input.operatorNote?.trim() || null,
    })
    .select(
      "id,club_id,guest_user_id,display_name,gender,career_text,group_code,operator_note,linked_club_member_id",
    )
    .single();

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("수동 게스트 프로필 생성 실패"));
  }

  return toGuestProfile(data as GuestProfileRow);
}

export async function getGuestInvite(
  eventId: string,
): Promise<ClubRecordGuestInvite | null> {
  await requireUser();

  const { data, error } = await getSupabaseClient()
    .from("club_record_guest_invites")
    .select("id,club_id,event_id,code,expires_at,is_active")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw mapClubRecordError(error);
  if (!data) return null;

  return toGuestInvite(data as GuestInviteRow);
}

export async function createGuestInvite(
  eventId: string,
): Promise<ClubRecordGuestInvite> {
  const user = await requireUser();

  const { data: eventRow, error: eventError } = await getSupabaseClient()
    .from("club_record_events")
    .select("club_id")
    .eq("id", eventId)
    .single();

  if (eventError || !eventRow) {
    throw mapClubRecordError(eventError ?? new Error("이벤트를 찾을 수 없습니다."));
  }

  const { data, error } = await getSupabaseClient()
    .from("club_record_guest_invites")
    .upsert(
      {
        club_id: String(eventRow.club_id),
        event_id: eventId,
        code: generateGuestInviteCode(),
        issued_by: user.id,
        is_active: true,
      },
      {
        onConflict: "event_id",
      },
    )
    .select("id,club_id,event_id,code,expires_at,is_active")
    .single();

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("게스트 초대코드 생성 실패"));
  }

  return toGuestInvite(data as GuestInviteRow);
}

export async function disableGuestInvite(eventId: string): Promise<void> {
  await requireUser();

  const { error } = await getSupabaseClient()
    .from("club_record_guest_invites")
    .update({
      is_active: false,
    })
    .eq("event_id", eventId);

  if (error) throw mapClubRecordError(error);
}

export async function verifyGuestInviteCode(
  code: string,
): Promise<ClubRecordGuestInviteVerification> {
  await requireUser();

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("게스트 초대코드를 입력해주세요.");
  }

  const { data, error } = await getSupabaseClient().rpc(
    "verify_club_record_guest_invite_code",
    {
      p_code: normalizedCode,
    },
  );

  if (error) throw mapClubRecordError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("유효한 게스트 초대코드를 찾을 수 없습니다.");
  }

  return toGuestInviteVerification(row as GuestInviteVerificationRow);
}

export async function joinEventAsGuestByInviteCode(
  code: string,
  input: ClubRecordGuestJoinInput,
): Promise<ClubRecordGuestJoinResult> {
  await requireUser();

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("게스트 초대코드를 입력해주세요.");
  }

  const { data, error } = await getSupabaseClient().rpc(
    "join_club_record_event_guest_by_invite_code",
    {
      p_code: normalizedCode,
      p_display_name: input.displayName?.trim() || null,
      p_gender: input.gender?.trim() || null,
      p_career_text: input.careerText?.trim() || null,
      p_group_code: input.groupCode ?? null,
      p_arrival_time: input.arrivalTime ?? null,
    },
  );

  if (error) throw mapClubRecordError(error);

  const row = (Array.isArray(data) ? data[0] : data) as GuestJoinRpcRow | undefined;
  if (!row) {
    throw new Error("게스트 참가자 정보를 찾을 수 없습니다.");
  }

  const verification = toGuestInviteVerification(row);
  const guestProfile = toGuestProfile({
    id: row.guest_profile_id,
    club_id: row.club_id,
    guest_user_id: row.guest_user_id,
    display_name: row.display_name,
    gender: row.gender,
    career_text: row.career_text,
    group_code: row.group_code,
    operator_note: null,
    linked_club_member_id: row.linked_club_member_id,
  });

  return {
    verification,
    guestProfile,
    participantId: row.participant_id,
  };
}
