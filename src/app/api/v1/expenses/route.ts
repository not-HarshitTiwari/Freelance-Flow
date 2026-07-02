import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!auth.scopes.includes("read") && !auth.scopes.includes("expenses")) {
    return NextResponse.json({ error: "API key missing 'read' or 'expenses' scope" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("expenses")
    .select("id, title, amount, category, date, notes, receipt_url, is_recurring, recurrence_interval, created_at")
    .eq("user_id", auth.userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category", category);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenses: data, offset, limit });
}
