import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, canManageWorkspace } from "@/lib/team";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await (await import("@/lib/team")).getWorkspaceRole(supabase, user.id);
  if (!canManageWorkspace(role)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const action = url.searchParams.get("action") || null;

  let query = supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, meta, actor_email, created_at", { count: "exact" })
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) query = query.eq("action", action);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [], total: count || 0 });
}
