import { getSupabaseClient } from "@/lib/supabase/client";

type AuditLogInput = {
  clubId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput) {
  const { error } = await getSupabaseClient().from("audit_logs").insert({
    club_id: input.clubId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload: input.payload ?? {},
  });

  if (error) {
    console.error("Audit log write failed:", error);
  }
}
