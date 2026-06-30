import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("products_services")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, type, unit_price, unit, hsn_code, track_inventory, quantity } = body;

  const trackInventory = type === "product" && !!track_inventory;

  const { data, error } = await supabase
    .from("products_services")
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      type: type === "product" ? "product" : "service",
      unit_price: parseFloat(unit_price) || 0,
      unit: unit || "unit",
      hsn_code: hsn_code || null,
      track_inventory: trackInventory,
      quantity: trackInventory ? parseFloat(quantity) || 0 : null,
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

  const { id, name, description, type, unit_price, unit, hsn_code, track_inventory, quantity } = await req.json();

  const trackInventory = type === "product" && !!track_inventory;

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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabase.from("products_services").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
