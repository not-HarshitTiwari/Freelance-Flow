import { createAdminClient } from "@/lib/supabase/admin";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Public endpoint hit from the client portal page — auth is via the per-client
// portal token (client_portals.token), not a Supabase session. The invoice amount
// is always computed server-side from the DB; never trust a client-supplied amount.
export async function POST(request: Request) {
  const { invoiceId, portalToken } = await request.json();
  if (!invoiceId || !portalToken) {
    return NextResponse.json({ error: "Missing invoiceId or portalToken" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: portal } = await supabase
    .from("client_portals")
    .select("client_id, user_id")
    .eq("token", portalToken)
    .single();
  if (!portal) return NextResponse.json({ error: "Invalid portal link" }, { status: 401 });

  const { data: client } = await supabase
    .from("clients")
    .select("name, email")
    .eq("id", portal.client_id)
    .single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Verify this invoice actually belongs to the client behind this portal token —
  // prevents paying an arbitrary invoiceId via a stolen/guessed id.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, status, customer_name, customer_email")
    .eq("id", invoiceId)
    .eq("user_id", portal.user_id)
    .single();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const belongsToClient =
    (client.email && invoice.customer_email && client.email.toLowerCase() === invoice.customer_email.toLowerCase()) ||
    (client.name && invoice.customer_name && client.name.toLowerCase() === invoice.customer_name.toLowerCase());
  if (!belongsToClient) return NextResponse.json({ error: "Invoice does not belong to this client" }, { status: 403 });

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  const balance = invoice.total - (invoice.amount_paid ?? 0);
  const amountPaise = Math.round(balance * 100);
  if (amountPaise < 100) {
    return NextResponse.json({ error: "Amount must be at least ₹1" }, { status: 400 });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: invoice.invoice_number,
      notes: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, portal_token: portalToken },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const message = err instanceof Error ? err.message : "Failed to create order";
    if (statusCode === 401) return NextResponse.json({ error: "Razorpay authentication failed" }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
