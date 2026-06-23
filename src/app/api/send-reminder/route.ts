import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceId } = await request.json();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(name, email), profiles(full_name, business_name)")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!invoice || !invoice.clients?.email) {
    return NextResponse.json({ error: "Invoice or client not found" }, { status: 404 });
  }

  const senderName = invoice.profiles?.business_name || invoice.profiles?.full_name || "Your Freelancer";
  const clientName = invoice.clients.name;
  const amount = `₹${invoice.total.toLocaleString("en-IN")}`;
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "as soon as possible";

  try {
    await resend.emails.send({
      from: "FreelanceFlow <noreply@freelanceflow.in>",
      to: invoice.clients.email,
      subject: `Payment Reminder: Invoice ${invoice.invoice_number} — ${amount}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
          <h2 style="color: #7c3aed;">Payment Reminder</h2>
          <p>Hi ${clientName},</p>
          <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> for <strong>${amount}</strong> is due by <strong>${dueDate}</strong>.</p>
          <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0;"><strong>Invoice:</strong> ${invoice.invoice_number}</p>
            <p style="margin: 8px 0 0;"><strong>Amount:</strong> ${amount}</p>
            <p style="margin: 8px 0 0;"><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <p>Please process the payment at your earliest convenience. If you have any questions, feel free to reply to this email.</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br/><strong>${senderName}</strong></p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
