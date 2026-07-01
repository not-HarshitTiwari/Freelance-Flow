import type { SupabaseClient } from "@supabase/supabase-js";

export async function getWorkspaceOwnerId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("team_members")
    .select("owner_id")
    .eq("member_id", userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return data?.owner_id ?? userId;
}
