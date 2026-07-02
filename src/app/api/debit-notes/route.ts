import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";
import { generateDebitNoteNumber } from "@/lib/debit-note-number";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data } = await supabase
    .from("debit_notes")
    .select("*, invoices(invoice_number, customer_name, customer_email, total)")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ debitNotes: data || [] });
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

  const debitNoteNumber = await generateDebitNoteNumber(supabase, ownerId);

  const { data: debitNote, error } = await supabase.from("debit_notes").insert({
    user_id: ownerId,
    invoice_id: invoiceId,
    debit_note_number: debitNoteNumber,
    reason: reason || null,
    amount: amt,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increase invoice total to reflect extra charge
  const newTotal = invoice.total + amt;
  const dateStr = new Date().toLocaleDateString("en-IN");
  const newEntry = `${dateStr}: +₹${amt.toLocaleString("en-IN")} — Debit Note ${debitNoteNumber}${reason ? `: ${reason}` : ""}`;
  const updatedNote = invoice.payment_note ? `${invoice.payment_note}\n${newEntry}` : newEntry;

  // Recompute status after total increase
  const amtPaid = invoice.amount_paid ?? 0;
  const newStatus = amtPaid >= newTotal ? "paid" : amtPaid > 0 ? "partial" : invoice.status === "overdue" ? "overdue" : "unpaid";

  await supabase.from("invoices")
    .update({ total: newTotal, status: newStatus, payment_note: updatedNote })
    .eq("id", invoiceId)
    .eq("user_id", ownerId);

  return NextResponse.json({ debitNote });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { id } = await request.json();

  const { data: dn } = await supabase.from("debit_notes").select("invoice_id, amount").eq("id", id).eq("user_id", ownerId).single();
  if (!dn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reverse the total increase
  const { data: invoice } = await supabase.from("invoices").select("total, amount_paid, status").eq("id", dn.invoice_id).eq("user_id", ownerId).single();
  if (invoice) {
    const newTotal = invoice.total - dn.amount;
    const amtPaid = invoice.amount_paid ?? 0;
    const newStatus = amtPaid >= newTotal ? "paid" : amtPaid > 0 ? "partial" : "unpaid";
    await supabase.from("invoices").update({ total: newTotal, status: newStatus }).eq("id", dn.invoice_id).eq("user_id", ownerId);
  }

  await supabase.from("debit_notes").delete().eq("id", id).eq("user_id", ownerId);
  return NextResponse.json({ ok: true });
}
