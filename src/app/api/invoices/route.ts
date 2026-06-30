import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateInvoiceNumber } from "@/lib/invoice-number";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    items, gst_type, gst_rate, due_date, invoice_date,
    payment_methods, transaction_id, notes, terms,
    upi_id, bank_account_name, bank_account_number, bank_ifsc, bank_name,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin, customer_email,
    is_recurring, recurrence_interval, next_invoice_date,
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

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const plan = profile?.plan || "free";

  // Free plan: max 5 invoices total
  if (plan === "free") {
    const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: "Free plan limit reached. Upgrade to Basic or higher to create unlimited invoices." }, { status: 403 });
    }
  }

  // Recurring invoices require Pro or higher
  const wantsRecurring = !!is_recurring && ["pro", "advanced"].includes(plan);

  const invoiceNumber = await generateInvoiceNumber(supabase, user.id);

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
    payment_methods: payment_methods || [],
    payment_method: (payment_methods || []).join(", ") || null,
    transaction_id: transaction_id || null,
    notes: notes || null,
    terms: terms || null,
    upi_id: upi_id || null,
    bank_account_name: bank_account_name || null,
    bank_account_number: bank_account_number || null,
    bank_ifsc: bank_ifsc || null,
    bank_name: bank_name || null,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_company, customer_address, customer_gstin,
    customer_email: customer_email || null,
    is_recurring: wantsRecurring,
    recurrence_interval: wantsRecurring ? recurrence_interval : null,
    next_invoice_date: wantsRecurring ? next_invoice_date : null,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const item of items as { product_id?: string; quantity: number }[]) {
    if (item.product_id) {
      await supabase.rpc("decrement_product_stock", { p_id: item.product_id, qty: item.quantity });
    }
  }

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
  const {
    id,
    invoice_date, due_date, items, subtotal, tax, cgst, sgst, igst, gst_type, gst_rate, total,
    status, amount_paid, payment_methods, payment_method, transaction_id,
    upi_id, bank_account_name, bank_account_number, bank_ifsc, bank_name,
    notes, terms,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_email, customer_company, customer_address, customer_gstin,
    is_recurring, recurrence_interval, next_invoice_date,
    payment_link, payment_link_id, reminder_sent_at,
  } = body;

  if (is_recurring) {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    if (!profile?.plan || !["pro", "advanced"].includes(profile.plan)) {
      return NextResponse.json({ error: "Recurring invoices require a Pro plan or higher." }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};
  const allowed = {
    invoice_date, due_date, items, subtotal, tax, cgst, sgst, igst, gst_type, gst_rate, total,
    status, amount_paid, payment_methods, payment_method, transaction_id,
    upi_id, bank_account_name, bank_account_number, bank_ifsc, bank_name,
    notes, terms,
    seller_name, seller_address, seller_email, seller_phone, seller_gstin,
    customer_name, customer_email, customer_company, customer_address, customer_gstin,
    is_recurring, recurrence_interval, next_invoice_date,
    payment_link, payment_link_id, reminder_sent_at,
  };
  for (const [k, v] of Object.entries(allowed)) {
    if (v !== undefined) updates[k] = v;
  }

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
