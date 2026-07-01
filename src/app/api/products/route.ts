import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data, error } = await supabase
    .from("products_services")
    .select("*")
    .eq("user_id", ownerId)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const body = await req.json();
  const { name, description, type, unit_price, unit, hsn_code, track_inventory, quantity, low_stock_threshold, margin_pct } = body;

  const trackInventory = type === "product" && !!track_inventory;
  const parsedMargin = margin_pct !== undefined && margin_pct !== "" ? parseFloat(margin_pct) : 100;

  const { data, error } = await supabase
    .from("products_services")
    .insert({
      user_id: ownerId,
      name,
      description: description || null,
      type: type === "product" ? "product" : "service",
      unit_price: parseFloat(unit_price) || 0,
      unit: unit || "unit",
      hsn_code: hsn_code || null,
      track_inventory: trackInventory,
      quantity: trackInventory ? parseFloat(quantity) || 0 : null,
      low_stock_threshold: trackInventory ? (parseFloat(low_stock_threshold) || 3) : 3,
      margin_pct: Math.min(100, Math.max(0, parsedMargin)),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { id, name, description, type, unit_price, unit, hsn_code, track_inventory, quantity, low_stock_threshold, margin_pct } = await req.json();

  const trackInventory = type === "product" && !!track_inventory;
  const parsedMargin = margin_pct !== undefined && margin_pct !== "" ? parseFloat(margin_pct) : 100;

  const { error } = await supabase
    .from("products_services")
    .update({
      name,
      description: description || null,
      type: type === "product" ? "product" : "service",
      unit_price: parseFloat(unit_price) || 0,
      unit: unit || "unit",
      hsn_code: hsn_code || null,
      track_inventory: trackInventory,
      quantity: trackInventory ? parseFloat(quantity) || 0 : null,
      low_stock_threshold: trackInventory ? (parseFloat(low_stock_threshold) || 3) : 3,
      margin_pct: Math.min(100, Math.max(0, parsedMargin)),
      low_stock_alert_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { id } = await req.json();
  const { error } = await supabase.from("products_services").delete().eq("id", id).eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
