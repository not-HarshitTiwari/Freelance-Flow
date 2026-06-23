import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { clientId, items, tax, dueDate } = body;

  const subtotal: number = items.reduce(
    (sum: number, item: { quantity: number; rate: number }) => sum + item.quantity * item.rate,
    0
  );
  const taxAmount = (subtotal * (tax || 0)) / 100;
  const total = subtotal + taxAmount;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  const { data, error } = await supabase.from("invoices").insert({
    user_id: user.id,
    client_id: clientId || null,
    invoice_number: invoiceNumber,
    items,
    subtotal,
    tax: taxAmount,
    total,
    due_date: dueDate || null,
    status: "unpaid",
  }).select("*, clients(name, email)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("invoices")
    .select("*, clients(name, email)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invoices: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await request.json();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
