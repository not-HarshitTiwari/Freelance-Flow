import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";

type Split = { amount: number; method?: string | null; note?: string | null };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow recording payments." }, { status: 403 });

  const body = await request.json();
  const { invoiceId, amount, note, method, splits } = body;

  const rawSplits: Split[] = Array.isArray(splits) && splits.length > 0
    ? splits
    : [{ amount: parseFloat(amount), method: method || null, note: note || null }];

  const parsedSplits = rawSplits
    .map(s => ({ amount: parseFloat(String(s.amount)), method: s.method || null, note: s.note || null }))
    .filter(s => s.amount > 0);

  if (parsedSplits.length === 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, amount_paid, status, payment_note")
    .eq("id", invoiceId)
    .eq("user_id", ownerId)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const splitTotal = parsedSplits.reduce((s, p) => s + p.amount, 0);
  const newAmountPaid = Math.min((invoice.amount_paid ?? 0) + splitTotal, invoice.total);
  const newStatus = newAmountPaid >= invoice.total ? "paid" : "partial";

  // Append to payment history instead of overwriting
  const dateStr = new Date().toLocaleDateString("en-IN");
  const entryLines = parsedSplits.map(s => `${dateStr}: ₹${s.amount.toLocaleString("en-IN")}${s.method ? ` via ${s.method}` : ""}${s.note ? ` — ${s.note}` : ""}`);
  const updatedNote = invoice.payment_note
    ? `${invoice.payment_note}\n${entryLines.join("\n")}`
    : entryLines.join("\n");

  const { data, error } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      payment_note: updatedNote,
    })
    .eq("id", invoiceId)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("payments").insert(
    parsedSplits.map(s => ({
      user_id: ownerId,
      invoice_id: invoiceId,
      amount: s.amount,
      method: s.method,
      note: s.note,
    }))
  );

  return NextResponse.json({ invoice: data });
}
