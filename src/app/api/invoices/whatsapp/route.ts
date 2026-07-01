import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId } from "@/lib/team";
import { isWhatsAppCloudConfigured, sendWhatsAppText, buildWaMeLink } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { invoiceId, kind } = await request.json();
  if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });

  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).eq("user_id", ownerId).single(),
    supabase.from("profiles").select("business_name, full_name").eq("id", ownerId).single(),
  ]);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const senderName = profile?.business_name || profile?.full_name || "FreelanceFlow";
  const balance = invoice.total - (invoice.amount_paid ?? 0);
  const isReminder = kind === "remind";

  const message = isReminder
    ? `Hi ${invoice.customer_name || "there"}, this is a reminder that invoice ${invoice.invoice_number} for ₹${balance.toLocaleString("en-IN")} from ${senderName}${invoice.due_date ? ` was due on ${new Date(invoice.due_date).toLocaleDateString("en-IN")}` : ""}.${invoice.payment_link ? ` Pay here: ${invoice.payment_link}` : ""} Thank you!`
    : `Hi ${invoice.customer_name || "there"}, please find your invoice ${invoice.invoice_number} for ₹${invoice.total.toLocaleString("en-IN")} from ${senderName}${invoice.due_date ? `, due on ${new Date(invoice.due_date).toLocaleDateString("en-IN")}` : ""}.${invoice.payment_link ? ` Pay here: ${invoice.payment_link}` : ""} Thank you!`;

  if (!isWhatsAppCloudConfigured() || !invoice.customer_phone) {
    return NextResponse.json({ fallback: true, link: buildWaMeLink(invoice.customer_phone, message) });
  }

  const result = await sendWhatsAppText(invoice.customer_phone, message);
  if (!result.ok) {
    return NextResponse.json({ fallback: true, link: buildWaMeLink(invoice.customer_phone, message) });
  }

  if (isReminder) {
    await supabase.from("invoices").update({ whatsapp_sent_at: new Date().toISOString() }).eq("id", invoiceId);
  }

  return NextResponse.json({ success: true });
}
