import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { sendLowStockAlerts } from "@/lib/low-stock-alerts";
import { isWhatsAppCloudConfigured, sendWhatsAppText } from "@/lib/whatsapp";

// Vercel cron calls this every day at 9am IST
export async function GET(req: Request) {
  // Verify cron secret so nobody else can call this
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find all unpaid and partial invoices where due_date has passed
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, customer_email, customer_phone, total, amount_paid, due_date, user_id, reminder_sent_at, whatsapp_sent_at, payment_link, status")
    .in("status", ["unpaid", "partial", "overdue"])
    .lt("due_date", today)
    .or("customer_email.not.is.null,customer_phone.not.is.null");

  // Mark all overdue unpaid invoices as "overdue" in the DB
  const unpaidIds = (overdueInvoices ?? []).filter(i => i.status === "unpaid").map(i => i.id);
  if (unpaidIds.length > 0) {
    await supabase.from("invoices").update({ status: "overdue" }).in("id", unpaidIds);
  }

  let sent = 0;

  for (const inv of overdueInvoices ?? []) {
    const remaining = inv.total - (inv.amount_paid ?? 0);
    if (remaining <= 0) continue; // fully paid partial, skip

    // Get user's SMTP settings and reminder cadence
    const { data: profile } = await supabase
      .from("profiles")
      .select("smtp_email, smtp_password, full_name, business_name, reminder_cadence_days")
      .eq("id", inv.user_id)
      .single();

    const cadenceDays = profile?.reminder_cadence_days ?? 3;
    const overdueDays = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));

    // WhatsApp reminder — independent channel & cadence from email
    if (inv.customer_phone && isWhatsAppCloudConfigured()) {
      const dueSince = inv.whatsapp_sent_at
        ? (Date.now() - new Date(inv.whatsapp_sent_at).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      if (dueSince >= cadenceDays) {
        const senderName = profile?.business_name || profile?.full_name || "FreelanceFlow";
        const message = `Hi ${inv.customer_name || "there"}, this is a reminder that invoice ${inv.invoice_number} for ₹${remaining.toLocaleString("en-IN")} from ${senderName} was due on ${new Date(inv.due_date).toLocaleDateString("en-IN")} (${overdueDays} day${overdueDays !== 1 ? "s" : ""} ago).${inv.payment_link ? ` Pay here: ${inv.payment_link}` : ""} Thank you!`;
        const result = await sendWhatsAppText(inv.customer_phone, message);
        if (result.ok) await supabase.from("invoices").update({ whatsapp_sent_at: new Date().toISOString() }).eq("id", inv.id);
      }
    }

    if (!inv.customer_email || !profile?.smtp_email || !profile?.smtp_password) continue;

    // Don't spam — only send if no reminder within the user's configured cadence
    if (inv.reminder_sent_at) {
      const lastSent = new Date(inv.reminder_sent_at);
      const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < cadenceDays) continue;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 587, secure: false,
        auth: { user: profile.smtp_email, pass: profile.smtp_password },
      });

      const senderName = profile.business_name || profile.full_name || profile.smtp_email;

      await transporter.sendMail({
        from: `"${senderName}" <${profile.smtp_email}>`,
        to: inv.customer_email,
        subject: `Payment Reminder — Invoice ${inv.invoice_number} is overdue`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
            <h2 style="color:#7c3aed;">Payment Reminder</h2>
            <p>Dear ${inv.customer_name || "Client"},</p>
            <p>This is a friendly reminder that Invoice <strong>${inv.invoice_number}</strong> for
            <strong>₹${inv.total.toLocaleString("en-IN")}</strong> was due on
            <strong>${new Date(inv.due_date).toLocaleDateString("en-IN")}</strong>
            (${overdueDays} day${overdueDays !== 1 ? "s" : ""} ago).</p>
            ${(inv.amount_paid ?? 0) > 0 ? `<p>You have paid <strong>₹${inv.amount_paid!.toLocaleString("en-IN")}</strong>. The outstanding balance is <strong>₹${remaining.toLocaleString("en-IN")}</strong>.</p>` : ""}
            ${inv.payment_link ? `<a href="${inv.payment_link}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;margin:8px 0 16px">Pay Now ↗</a>` : ""}
            <p>Please arrange payment at your earliest convenience.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
            <p style="color:#666;font-size:13px;">Sent by ${senderName} via FreelanceFlow</p>
          </div>
        `,
      });

      // Mark reminder sent
      await supabase.from("invoices").update({ reminder_sent_at: new Date().toISOString() }).eq("id", inv.id);
      sent++;
    } catch {
      // Continue to next invoice even if one fails
    }
  }

  // Pre-due reminders: invoices due in exactly 3 days, not yet reminded
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().slice(0, 10);

  const { data: upcomingInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, customer_email, total, amount_paid, due_date, user_id, payment_link")
    .in("status", ["unpaid", "partial"])
    .eq("due_date", in3DaysStr)
    .not("customer_email", "is", null);

  let preSent = 0;
  for (const inv of upcomingInvoices ?? []) {
    const remaining = inv.total - (inv.amount_paid ?? 0);
    if (remaining <= 0) continue;
    const { data: profile } = await supabase
      .from("profiles")
      .select("smtp_email, smtp_password, full_name, business_name")
      .eq("id", inv.user_id)
      .single();
    if (!profile?.smtp_email || !profile?.smtp_password) continue;
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 587, secure: false,
        auth: { user: profile.smtp_email, pass: profile.smtp_password },
      });
      const senderName = profile.business_name || profile.full_name || profile.smtp_email;
      await transporter.sendMail({
        from: `"${senderName}" <${profile.smtp_email}>`,
        to: inv.customer_email,
        subject: `Upcoming Payment — Invoice ${inv.invoice_number} due in 3 days`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
            <h2 style="color:#7c3aed;">Payment Due Soon</h2>
            <p>Dear ${inv.customer_name || "Client"},</p>
            <p>This is a friendly reminder that Invoice <strong>${inv.invoice_number}</strong> for
            <strong>₹${remaining.toLocaleString("en-IN")}</strong> is due in <strong>3 days</strong>
            on <strong>${new Date(inv.due_date).toLocaleDateString("en-IN")}</strong>.</p>
            ${inv.payment_link ? `<a href="${inv.payment_link}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;margin:8px 0 16px">Pay Now ↗</a>` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
            <p style="color:#666;font-size:13px;">Sent by ${senderName} via FreelanceFlow</p>
          </div>
        `,
      });
      preSent++;
    } catch { /* continue */ }
  }

  const lowStockAlertsSent = await sendLowStockAlerts(supabase);

  return NextResponse.json({ sent, preSent, lowStockAlertsSent });
}
