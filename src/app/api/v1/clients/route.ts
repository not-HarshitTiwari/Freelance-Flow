import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateApiKey } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!auth.scopes.includes("read") && !auth.scopes.includes("clients")) {
    return NextResponse.json({ error: "API key missing 'read' or 'clients' scope" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const search = searchParams.get("search");

  let query = supabase
    .from("clients")
    .select("id, name, email, phone, company, address, gstin, notes, created_at")
    .eq("user_id", auth.userId)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clients: data, offset, limit });
}
