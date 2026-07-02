import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  meta: Record<string, unknown> = {},
  actorEmail?: string
) {
  await supabase.from("audit_log").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    meta,
    actor_email: actorEmail || null,
  });
}
