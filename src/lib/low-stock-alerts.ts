import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

/**
 * Finds tracked products at or below their low-stock threshold and emails each
 * affected user a single digest. Throttled per-product via low_stock_alert_sent_at
 * so the same item doesn't trigger a new email more than once every 3 days.
 */
export async function sendLowStockAlerts(supabase: SupabaseClient): Promise<number> {
  const { data: lowStockProducts } = await supabase
    .from("products_services")
    .select("id, user_id, name, quantity, low_stock_threshold, low_stock_alert_sent_at")
    .eq("track_inventory", true)
    .not("quantity", "is", null);

  if (!lowStockProducts?.length) return 0;

  const dueForAlert = lowStockProducts.filter(p => {
    if ((p.quantity ?? 0) > (p.low_stock_threshold ?? 3)) return false;
    if (!p.low_stock_alert_sent_at) return true;
    const daysSince = (Date.now() - new Date(p.low_stock_alert_sent_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 3;
  });

  if (!dueForAlert.length) return 0;

  const byUser = new Map<string, typeof dueForAlert>();
  for (const p of dueForAlert) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
    byUser.get(p.user_id)!.push(p);
  }

  let sent = 0;

  for (const [userId, items] of byUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("smtp_email, smtp_password, full_name, business_name")
      .eq("id", userId)
      .single();

    if (!profile?.smtp_email || !profile?.smtp_password) continue;

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 587, secure: false,
        auth: { user: profile.smtp_email, pass: profile.smtp_password },
      });

      const senderName = profile.business_name || profile.full_name || profile.smtp_email;
      const rows = items.map(p => {
        const out = (p.quantity ?? 0) <= 0;
        return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:${out ? "#dc2626" : "#d97706"};font-weight:600;">${out ? "Out of stock" : `${p.quantity} left`}</td></tr>`;
      }).join("");

      await transporter.sendMail({
        from: `"${senderName}" <${profile.smtp_email}>`,
        to: profile.smtp_email,
        subject: `Low stock alert — ${items.length} item${items.length !== 1 ? "s" : ""} need restocking`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
            <h2 style="color:#7c3aed;">Low Stock Alert</h2>
            <p>The following items in your catalog are running low:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
            <p>Restock soon to avoid running out on your next invoice.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
            <p style="color:#666;font-size:13px;">Sent by FreelanceFlow</p>
          </div>
        `,
      });

      await supabase
        .from("products_services")
        .update({ low_stock_alert_sent_at: new Date().toISOString() })
        .in("id", items.map(p => p.id));

      sent++;
    } catch {
      // Continue to next user even if one fails
    }
  }

  return sent;
}
