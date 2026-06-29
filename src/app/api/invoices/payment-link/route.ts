import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceId } = await request.json();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, total, amount_paid, invoice_number, customer_name, customer_email, payment_link, payment_link_id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const balance = invoice.total - (invoice.amount_paid ?? 0);
  if (balance <= 0) return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    // Cancel the existing payment link before creating a new one to prevent double payment
    if (invoice.payment_link_id) {
      try {
        await razorpay.paymentLink.cancel(invoice.payment_link_id);
      } catch { /* link may already be paid or expired — proceed */ }
    }

    const link = await razorpay.paymentLink.create({
      amount: Math.round(balance * 100),
      currency: "INR",
      description: `Invoice ${invoice.invoice_number}`,
      customer: {
        name: invoice.customer_name || undefined,
        email: invoice.customer_email || undefined,
      },
      notify: { email: !!invoice.customer_email, sms: false },
      reminder_enable: true,
      notes: { invoice_id: invoiceId, invoice_number: invoice.invoice_number },
    });

    await supabase.from("invoices")
      .update({ payment_link: link.short_url, payment_link_id: link.id })
      .eq("id", invoiceId);

    return NextResponse.json({ url: link.short_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create payment link: ${msg}` }, { status: 500 });
  }
}
