import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { data } = await supabase.from("time_entries").select("*").eq("user_id", ownerId).order("date", { ascending: false });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { description, client_name, hours, rate, date } = await request.json();
  const { data, error } = await supabase.from("time_entries")
    .insert({ description, client_name: client_name || null, hours, rate: rate || 0, date, user_id: ownerId })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { id, description, client_name, hours, rate, date, billed } = await request.json();
  const updates: Record<string, unknown> = {};
  if (description !== undefined) updates.description = description;
  if (client_name !== undefined) updates.client_name = client_name || null;
  if (hours !== undefined) updates.hours = hours;
  if (rate !== undefined) updates.rate = rate;
  if (date !== undefined) updates.date = date;
  if (billed !== undefined) updates.billed = billed;
  const { data, error } = await supabase.from("time_entries")
    .update(updates).eq("id", id).eq("user_id", ownerId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { id } = await request.json();
  const { error } = await supabase.from("time_entries").delete().eq("id", id).eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
