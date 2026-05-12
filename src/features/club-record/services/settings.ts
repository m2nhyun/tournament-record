import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ClubRecordSettings,
  ClubRecordSettingsUpdateInput,
} from "@/features/club-record/types/settings";
import { mapClubRecordError } from "@/features/club-record/services/errors";
import { requireClubRecordAdminAccess } from "@/features/club-record/services/access";

type SettingsRow = {
  club_id: string;
  group_a_percent: number;
  group_b_percent: number;
  group_c_percent: number;
  updated_at: string;
};

function toSettings(row: SettingsRow, clubId: string): ClubRecordSettings {
  return {
    clubId,
    groupAPercent: row.group_a_percent,
    groupBPercent: row.group_b_percent,
    groupCPercent: row.group_c_percent,
    updatedAt: row.updated_at,
  };
}

export async function getClubRecordSettings(
  clubId: string,
): Promise<ClubRecordSettings> {
  await requireUser();
  await requireClubRecordAdminAccess(clubId, "설정은 운영진 이상만 조회할 수 있습니다.");

  const { data, error } = await getSupabaseClient()
    .from("club_record_settings")
    .select("club_id,group_a_percent,group_b_percent,group_c_percent,updated_at")
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) throw mapClubRecordError(error);

  if (!data) {
    return {
      clubId,
      groupAPercent: 20,
      groupBPercent: 30,
      groupCPercent: 50,
      updatedAt: new Date(0).toISOString(),
    };
  }

  return toSettings(data as SettingsRow, clubId);
}

export async function updateClubRecordSettings(
  clubId: string,
  input: ClubRecordSettingsUpdateInput,
): Promise<ClubRecordSettings> {
  await requireUser();
  await requireClubRecordAdminAccess(clubId, "설정은 운영진 이상만 수정할 수 있습니다.");

  const { data, error } = await getSupabaseClient()
    .from("club_record_settings")
    .upsert(
      {
        club_id: clubId,
        group_a_percent: input.groupAPercent,
        group_b_percent: input.groupBPercent,
        group_c_percent: input.groupCPercent,
      },
      {
        onConflict: "club_id",
      },
    )
    .select("club_id,group_a_percent,group_b_percent,group_c_percent,updated_at")
    .single();

  if (error || !data) {
    throw mapClubRecordError(error ?? new Error("club record 설정 저장 실패"));
  }

  return toSettings(data as SettingsRow, clubId);
}
