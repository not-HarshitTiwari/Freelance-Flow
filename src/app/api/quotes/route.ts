import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateQuoteNumber } from "@/lib/quote-number";
import { calculateGst } from "@/lib/gst";
import { getWorkspaceOwnerId } from "@/lib/team";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const body = await request.json();
  const {
    client_id, items, gst_type, gst_rate, valid_until, notes, terms,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin, customer_email,
  } = body;

  const { subtotal, cgst, sgst, igst, total } = calculateGst(items, gst_type, gst_rate);
  const quoteNumber = await generateQuoteNumber(supabase, ownerId);

  const { data, error } = await supabase.from("quotes").insert({
    user_id: ownerId,
    client_id: client_id || null,
    quote_number: quoteNumber,
    items,
    subtotal,
    gst_type, gst_rate,
    cgst, sgst, igst,
    total,
    status: "draft",
    valid_until: valid_until || null,
    notes: notes || null,
    terms: terms || null,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin,
    customer_email: customer_email || null,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data } = await supabase
    .from("quotes")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ quotes: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const body = await request.json();
  const {
    id, client_id, items, gst_type, gst_rate, valid_until, notes, terms, status,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin, customer_email,
  } = body;

  const updates: Record<string, unknown> = {};
  const allowed: Record<string, unknown> = {
    client_id, valid_until, notes, terms, status,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin, customer_email,
  };

  if (items !== undefined) {
    const { subtotal, cgst, sgst, igst, total } = calculateGst(items, gst_type, gst_rate);
    Object.assign(allowed, { items, gst_type, gst_rate, subtotal, cgst, sgst, igst, total });
  }

  for (const [k, v] of Object.entries(allowed)) {
    if (v !== undefined) updates[k] = v;
  }

  const { data, error } = await supabase
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { id } = await request.json();

  const { error } = await supabase.from("quotes").delete().eq("id", id).eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
