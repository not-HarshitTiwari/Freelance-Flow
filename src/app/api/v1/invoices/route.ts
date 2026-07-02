import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!auth.scopes.includes("read") && !auth.scopes.includes("invoices")) {
    return NextResponse.json({ error: "API key missing 'read' or 'invoices' scope" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, customer_name, customer_email, customer_company, total, amount_paid, status, invoice_type, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoices: data, offset, limit });
}
