import { requireUser } from "@/features/auth/services/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { mapClubRecordError } from "@/features/club-record/services/errors";

export async function cancelExpiredClubRecordMatches(): Promise<number> {
  await requireUser();

  const { data, error } = await getSupabaseClient().rpc(
    "cancel_expired_club_record_matches",
  );

  if (error) throw mapClubRecordError(error);

  return Number(data ?? 0);
}
