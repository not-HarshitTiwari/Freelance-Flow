import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

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
    .select("id, invoice_number, customer_name, customer_email, total, amount_paid, due_date, user_id, reminder_sent_at, payment_link")
    .in("status", ["unpaid", "partial", "overdue"])
    .lt("due_date", today)
    .not("customer_email", "is", null);

  if (!overdueInvoices?.length) return NextResponse.json({ sent: 0 });

  // Mark all overdue unpaid invoices as "overdue" in the DB
  const unpaidIds = overdueInvoices.filter(i => i.status === "unpaid").map(i => i.id);
  if (unpaidIds.length > 0) {
    await supabase.from("invoices").update({ status: "overdue" }).in("id", unpaidIds);
  }

  let sent = 0;

  for (const inv of overdueInvoices) {
    // Don't spam — only send if no reminder in last 3 days
    if (inv.reminder_sent_at) {
      const lastSent = new Date(inv.reminder_sent_at);
      const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) continue;
    }

    const remaining = inv.total - (inv.amount_paid ?? 0);
    if (remaining <= 0) continue; // fully paid partial, skip

    // Get user's SMTP settings
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
      const overdueDays = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));

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

  return NextResponse.json({ sent });
}
