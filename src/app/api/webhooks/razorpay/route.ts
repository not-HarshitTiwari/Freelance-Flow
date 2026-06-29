import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = JSON.parse(body) as { event: string; payload: any };

  // ── Subscription events (plan upgrades/cancellations) ──────────────────────
  if (event.event === "subscription.activated") {
    const supabase = await createClient();
    const notes = event.payload.subscription.entity.notes ?? {};
    const userId = notes.user_id;
    const subscriptionId = event.payload.subscription.entity.id;
    const activatedPlan = ["basic", "pro", "advanced"].includes(notes.plan) ? notes.plan : "pro";
    if (userId) {
      await supabase
        .from("profiles")
        .update({ plan: activatedPlan, razorpay_subscription_id: subscriptionId })
        .eq("id", userId);
    }
  }

  if (event.event === "subscription.cancelled" || event.event === "subscription.expired") {
    const supabase = await createClient();
    const subscriptionId = event.payload.subscription.entity.id;
    await supabase
      .from("profiles")
      .update({ plan: "free", razorpay_subscription_id: null })
      .eq("razorpay_subscription_id", subscriptionId);
  }

  // ── Payment link paid — auto-update invoice status ─────────────────────────
  if (event.event === "payment_link.paid") {
    const entity = event.payload.payment_link?.entity;
    const invoiceId = entity?.notes?.invoice_id;
    if (invoiceId) {
      const supabase = createAdminClient();
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, total, amount_paid, payment_note")
        .eq("id", invoiceId)
        .single();

      if (invoice) {
        const paidAmount = entity?.amount ? entity.amount / 100 : invoice.total;
        const newAmountPaid = Math.min((invoice.amount_paid ?? 0) + paidAmount, invoice.total);
        const newStatus = newAmountPaid >= invoice.total ? "paid" : "partial";
        const dateStr = new Date().toLocaleDateString("en-IN");
        const newEntry = `${dateStr}: ₹${paidAmount.toLocaleString("en-IN")} — Razorpay payment`;
        const updatedNote = invoice.payment_note
          ? `${invoice.payment_note}\n${newEntry}`
          : newEntry;

        await supabase.from("invoices").update({
          amount_paid: newAmountPaid,
          status: newStatus,
          payment_note: updatedNote,
        }).eq("id", invoiceId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
