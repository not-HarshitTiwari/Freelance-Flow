import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceId, amount, note } = await request.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, amount_paid, status, payment_note")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const newAmountPaid = Math.min((invoice.amount_paid ?? 0) + parseFloat(amount), invoice.total);
  const newStatus = newAmountPaid >= invoice.total ? "paid" : "partial";

  // Append to payment history instead of overwriting
  const dateStr = new Date().toLocaleDateString("en-IN");
  const newEntry = `${dateStr}: ₹${parseFloat(amount).toLocaleString("en-IN")}${note ? ` — ${note}` : ""}`;
  const updatedNote = invoice.payment_note
    ? `${invoice.payment_note}\n${newEntry}`
    : newEntry;

  const { data, error } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      payment_note: updatedNote,
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
