import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST — generate portal token for a client
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await req.json();
  const token = randomBytes(32).toString("hex");

  const { error } = await supabase.from("client_portals").upsert(
    { user_id: user.id, client_id: clientId, token },
    { onConflict: "client_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}

// GET — fetch portal data by token (public, no auth)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = await createClient();

  const { data: portal } = await supabase
    .from("client_portals")
    .select("client_id, user_id")
    .eq("token", token)
    .single();

  if (!portal) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const { data: clientData } = await supabase
    .from("clients").select("name, email, company").eq("id", portal.client_id).single();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_number, invoice_date, due_date, total, status, items, gst_amount, subtotal, payment_method, upi_id, notes")
    .eq("user_id", portal.user_id)
    .or(`customer_email.eq.${clientData?.email},customer_name.eq.${clientData?.name}`)
    .order("created_at", { ascending: false });

  return NextResponse.json({ client: clientData, invoices });
}
