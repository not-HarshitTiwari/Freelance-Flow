import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { getWorkspaceOwnerId, canManageWorkspace } from "@/lib/team";

// GET — list all API keys (hashed prefix shown only)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, prefix, created_at, last_used_at, scopes")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data || [] });
}

// POST — create a new API key
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await (await import("@/lib/team")).getWorkspaceRole(supabase, user.id);
  if (!canManageWorkspace(role)) return NextResponse.json({ error: "Workspace admin only." }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", ownerId).single();
  if (!["pro", "advanced"].includes(profile?.plan || "")) {
    return NextResponse.json({ error: "API key management requires Pro or Advanced plan." }, { status: 403 });
  }

  const { name, scopes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Generate: ff_<32-hex-chars>
  const raw = `ff_${randomBytes(16).toString("hex")}`;
  const prefix = raw.slice(0, 10); // ff_xxxxxxxx
  const hashed = createHash("sha256").update(raw).digest("hex");

  const { error } = await supabase.from("api_keys").insert({
    user_id: ownerId,
    name: name.trim(),
    prefix,
    key_hash: hashed,
    scopes: scopes || ["read"],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key: raw }); // shown once only
}

// DELETE — revoke a key
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await (await import("@/lib/team")).getWorkspaceRole(supabase, user.id);
  if (!canManageWorkspace(role)) return NextResponse.json({ error: "Workspace admin only." }, { status: 403 });

  const { id } = await req.json();
  const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
