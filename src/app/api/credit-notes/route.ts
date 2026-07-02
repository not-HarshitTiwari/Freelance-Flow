import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";
import { generateCreditNoteNumber } from "@/lib/credit-note-number";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data } = await supabase
    .from("credit_notes")
    .select("*, invoices(invoice_number, customer_name, customer_email, total)")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ creditNotes: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { invoiceId, amount, reason } = await request.json();
  const amt = parseFloat(amount);
  if (!invoiceId || !amt || amt <= 0) {
    return NextResponse.json({ error: "Missing invoiceId or invalid amount" }, { status: 400 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, amount_paid, status, payment_note, invoice_number")
    .eq("id", invoiceId)
    .eq("user_id", ownerId)
    .single();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const remaining = invoice.total - (invoice.amount_paid ?? 0);
  if (amt > remaining) {
    return NextResponse.json({ error: `Credit note amount can't exceed the outstanding balance (₹${remaining.toLocaleString("en-IN")}).` }, { status: 400 });
  }

  const creditNoteNumber = await generateCreditNoteNumber(supabase, ownerId);

  const { data: creditNote, error } = await supabase.from("credit_notes").insert({
    user_id: ownerId,
    invoice_id: invoiceId,
    credit_note_number: creditNoteNumber,
    reason: reason || null,
    amount: amt,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const newAmountPaid = (invoice.amount_paid ?? 0) + amt;
  const newStatus = newAmountPaid >= invoice.total ? "paid" : "partial";
  const dateStr = new Date().toLocaleDateString("en-IN");
  const newEntry = `${dateStr}: ₹${amt.toLocaleString("en-IN")} — Credit Note ${creditNoteNumber}${reason ? `: ${reason}` : ""}`;
  const updatedNote = invoice.payment_note ? `${invoice.payment_note}\n${newEntry}` : newEntry;

  await supabase.from("invoices").update({ amount_paid: newAmountPaid, status: newStatus, payment_note: updatedNote }).eq("id", invoiceId).eq("user_id", ownerId);

  await supabase.from("payments").insert({
    user_id: ownerId,
    invoice_id: invoiceId,
    amount: amt,
    note: `Credit Note ${creditNoteNumber}${reason ? `: ${reason}` : ""}`,
  });

  return NextResponse.json({ creditNote });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { id } = await request.json();

  const { data: cn } = await supabase.from("credit_notes").select("invoice_id, amount").eq("id", id).eq("user_id", ownerId).single();
  if (!cn) return NextResponse.json({ error: "Credit note not found" }, { status: 404 });

  const { data: invoice } = await supabase.from("invoices").select("amount_paid, total").eq("id", cn.invoice_id).eq("user_id", ownerId).single();
  if (invoice) {
    const newAmountPaid = Math.max(0, (invoice.amount_paid ?? 0) - cn.amount);
    const newStatus = newAmountPaid <= 0 ? "unpaid" : newAmountPaid >= invoice.total ? "paid" : "partial";
    await supabase.from("invoices").update({ amount_paid: newAmountPaid, status: newStatus }).eq("id", cn.invoice_id).eq("user_id", ownerId);
  }

  await supabase.from("credit_notes").delete().eq("id", id).eq("user_id", ownerId);
  return NextResponse.json({ success: true });
}
