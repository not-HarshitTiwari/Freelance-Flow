import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { invoiceId } = await request.json();

  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).eq("user_id", ownerId).single(),
    supabase.from("profiles").select("smtp_email, smtp_password, full_name, business_name").eq("id", ownerId).single(),
  ]);

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (!invoice.customer_email) return NextResponse.json({ error: "No customer email on this invoice" }, { status: 400 });
  if (!profile?.smtp_email || !profile?.smtp_password) return NextResponse.json({ error: "Configure Gmail SMTP in Settings first" }, { status: 400 });

  const senderName = profile.business_name || profile.full_name || profile.smtp_email;
  const overdueDays = invoice.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
    : 0;
  const dueStr = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "as soon as possible";
  const balance = invoice.total - (invoice.amount_paid ?? 0);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: profile.smtp_email, pass: profile.smtp_password },
    });

    await transporter.sendMail({
      from: `"${senderName}" <${profile.smtp_email}>`,
      to: invoice.customer_email,
      subject: `Payment Reminder — Invoice ${invoice.invoice_number}${overdueDays > 0 ? ` (${overdueDays} days overdue)` : ""}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
          <h2 style="color:#7c3aed;">Payment Reminder</h2>
          <p>Dear ${invoice.customer_name || "Client"},</p>
          <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> for
          <strong>₹${balance.toLocaleString("en-IN")}</strong> is due by <strong>${dueStr}</strong>${overdueDays > 0 ? ` — <span style="color:#dc2626">${overdueDays} day${overdueDays !== 1 ? "s" : ""} overdue</span>` : ""}.</p>
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px;margin:20px 0;border-radius:4px;">
            <p style="margin:0"><strong>Invoice:</strong> ${invoice.invoice_number}</p>
            <p style="margin:8px 0 0"><strong>Total:</strong> ₹${invoice.total.toLocaleString("en-IN")}</p>
            ${(invoice.amount_paid ?? 0) > 0 ? `<p style="margin:8px 0 0"><strong>Paid:</strong> ₹${(invoice.amount_paid ?? 0).toLocaleString("en-IN")}</p>` : ""}
            <p style="margin:8px 0 0"><strong>Balance Due:</strong> ₹${balance.toLocaleString("en-IN")}</p>
            <p style="margin:8px 0 0"><strong>Due Date:</strong> ${dueStr}</p>
          </div>
          ${invoice.payment_link ? `<a href="${invoice.payment_link}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;margin:8px 0 16px">Pay Now ↗</a>` : ""}
          <p>Please arrange payment at your earliest convenience. If you have any questions, feel free to reply to this email.</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br/><strong>${senderName}</strong></p>
        </div>
      `,
    });

    await supabase.from("invoices").update({ reminder_sent_at: new Date().toISOString() }).eq("id", invoiceId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send reminder email: ${msg}` }, { status: 500 });
  }
}
