import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  const { invoiceId, portalToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

  if (!invoiceId || !portalToken || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(razorpay_signature);
  const signatureValid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!signatureValid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Re-validate portal token -> invoice ownership (defense in depth, mirrors create-order)
  const { data: portal } = await supabase
    .from("client_portals")
    .select("client_id, user_id")
    .eq("token", portalToken)
    .single();
  if (!portal) return NextResponse.json({ error: "Invalid portal link" }, { status: 401 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, amount_paid, payment_note")
    .eq("id", invoiceId)
    .eq("user_id", portal.user_id)
    .single();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const dateStr = new Date().toLocaleDateString("en-IN");
  const newEntry = `${dateStr}: ₹${invoice.total - (invoice.amount_paid ?? 0)} — Razorpay (${razorpay_payment_id})`;
  const updatedNote = invoice.payment_note ? `${invoice.payment_note}\n${newEntry}` : newEntry;

  const { error } = await supabase
    .from("invoices")
    .update({
      amount_paid: invoice.total,
      status: "paid",
      payment_note: updatedNote,
      transaction_id: razorpay_payment_id,
    })
    .eq("id", invoiceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
