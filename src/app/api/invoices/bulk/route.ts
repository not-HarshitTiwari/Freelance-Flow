import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { applyStockChange, type StockItem } from "@/lib/stock";
import { planAtLeast, type Plan } from "@/lib/plan-context";
import type { SupabaseClient } from "@supabase/supabase-js";

const STOCK_WARNING = "Invoices deleted, but some stock counts couldn't be restored automatically.";

async function requireAdvanced(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).single();
  const plan = (profile?.plan || "free") as Plan;
  return planAtLeast(plan, "advanced");
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await requireAdvanced(supabase, user.id))) {
    return NextResponse.json({ error: "Bulk actions require the Advanced plan." }, { status: 403 });
  }

  const { ids } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "No invoices selected" }, { status: 400 });

  const { data: targets } = await supabase.from("invoices").select("id, total").eq("user_id", user.id).in("id", ids);
  if (!targets?.length) return NextResponse.json({ error: "No matching invoices" }, { status: 404 });

  for (const inv of targets) {
    await supabase.from("invoices").update({ status: "paid", amount_paid: inv.total }).eq("id", inv.id).eq("user_id", user.id);
  }

  return NextResponse.json({ updated: targets.length });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await requireAdvanced(supabase, user.id))) {
    return NextResponse.json({ error: "Bulk actions require the Advanced plan." }, { status: 403 });
  }

  const { ids } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "No invoices selected" }, { status: 400 });

  const { data: targets } = await supabase.from("invoices").select("id, items").eq("user_id", user.id).in("id", ids);
  if (!targets?.length) return NextResponse.json({ error: "No matching invoices" }, { status: 404 });

  const { error } = await supabase.from("invoices").delete().eq("user_id", user.id).in("id", targets.map(t => t.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let stockErrors: { product_id: string; message: string }[] = [];
  for (const inv of targets) {
    stockErrors = [...stockErrors, ...await applyStockChange(supabase, inv.items as StockItem[] | undefined, -1)];
  }

  return NextResponse.json({ deleted: targets.length, ...(stockErrors.length ? { stock_warning: STOCK_WARNING } : {}) });
}
