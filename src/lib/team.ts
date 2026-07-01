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

export type WorkspaceRole = "owner" | "admin" | "accountant" | "viewer";

// The workspace owner always has full access. Team members carry whatever
// role the owner assigned them at invite time (defaults to "admin").
export async function getWorkspaceRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceRole> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("member_id", userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return (data?.role as WorkspaceRole) ?? "owner";
}

export function canWrite(role: WorkspaceRole): boolean {
  return role !== "viewer";
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}
