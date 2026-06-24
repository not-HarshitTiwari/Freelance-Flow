import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    items, gst_type, gst_rate, due_date, invoice_date,
    payment_method, transaction_id, notes, terms,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin,
  } = body;

  const subtotal: number = items.reduce(
    (sum: number, item: { quantity: number; rate: number }) => sum + item.quantity * item.rate,
    0
  );

  const totalGst = (subtotal * (gst_rate || 0)) / 100;
  const cgst = gst_type === "cgst_sgst" ? totalGst / 2 : 0;
  const sgst = gst_type === "cgst_sgst" ? totalGst / 2 : 0;
  const igst = gst_type === "igst" ? totalGst : 0;
  const total = subtotal + totalGst;

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

  const { data, error } = await supabase.from("invoices").insert({
    user_id: user.id,
    invoice_number: invoiceNumber,
    invoice_date: invoice_date || new Date().toISOString().split("T")[0],
    items,
    subtotal,
    tax: totalGst,
    cgst, sgst, igst,
    gst_type, gst_rate,
    total,
    due_date: due_date || null,
    status: "unpaid",
    payment_method: payment_method || null,
    transaction_id: transaction_id || null,
    notes: notes || null,
    terms: terms || null,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invoices: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
