import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { quoteId } = await request.json();
  if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });

  const [{ data: quote }, { data: profile }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).eq("user_id", ownerId).single(),
    supabase.from("profiles").select("full_name, business_name, smtp_email, smtp_password").eq("id", ownerId).single(),
  ]);

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (!quote.customer_email) return NextResponse.json({ error: "Quote has no client email" }, { status: 400 });
  if (!profile?.smtp_email || !profile?.smtp_password) {
    return NextResponse.json({ error: "Configure Gmail SMTP in Settings first" }, { status: 400 });
  }

  let reviewToken = quote.review_token as string | null;
  if (!reviewToken) {
    reviewToken = randomBytes(32).toString("hex");
    await supabase.from("quotes").update({ review_token: reviewToken, status: "sent" }).eq("id", quoteId);
  } else {
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quoteId);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const reviewUrl = `${appUrl}/quote/${reviewToken}`;
  const senderName = profile.business_name || profile.full_name || "FreelanceFlow";
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: profile.smtp_email, pass: profile.smtp_password },
    });

    await transporter.sendMail({
      from: `"${senderName}" <${profile.smtp_email}>`,
      to: quote.customer_email,
      subject: `Quote ${quote.quote_number} from ${senderName} — ₹${quote.total.toLocaleString("en-IN")}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
          <h2 style="color:#7c3aed;">Quote from ${senderName}</h2>
          <p>Hi ${quote.customer_name || "there"},</p>
          <p>Please find your quote <strong>${quote.quote_number}</strong> for <strong>₹${quote.total.toLocaleString("en-IN")}</strong> attached below.</p>
          ${validUntil ? `<p>This quote is valid until <strong>${validUntil}</strong>.</p>` : ""}
          <a href="${reviewUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0;">
            Review & Accept Quote ↗
          </a>
          <p style="color:#666;font-size:13px;margin-top:24px;">You can accept or decline the quote using the link above.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <p style="color:#999;font-size:12px;">Sent by ${senderName} via FreelanceFlow</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send email: ${msg}` }, { status: 500 });
  }
}
