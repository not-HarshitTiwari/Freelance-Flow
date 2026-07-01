import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST — generate review token for a quote
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quoteId } = await req.json();
  const token = randomBytes(32).toString("hex");

  const { error } = await supabase.from("quotes")
    .update({ review_token: token, status: "sent" })
    .eq("id", quoteId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}

// GET — fetch quote by review token (public — RLS allows SELECT when review_token IS NOT NULL)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_number, items, subtotal, cgst, sgst, igst, total, status, valid_until, notes, terms, seller_name, seller_address, seller_email, seller_phone, seller_gstin, customer_name, customer_company, created_at")
    .eq("review_token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  return NextResponse.json({ quote: data });
}

// PATCH — client accepts or rejects (one-time only)
export async function PATCH(req: Request) {
  const { token, action } = await req.json();
  if (!token || !["accepted", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("quotes")
    .select("status")
    .eq("review_token", token)
    .single();

  if (!existing) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (["accepted", "rejected", "converted"].includes(existing.status)) {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("quotes")
    .update({ status: action })
    .eq("review_token", token)
    .select("user_id, quote_number")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the freelancer
  if (updated) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles")
        .select("smtp_email, smtp_password")
        .eq("id", updated.user_id)
        .single();
      if (profile?.smtp_email && profile?.smtp_password) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: profile.smtp_email, pass: profile.smtp_password },
        });
        const emoji = action === "accepted" ? "✅" : "❌";
        await transporter.sendMail({
          from: profile.smtp_email,
          to: profile.smtp_email,
          subject: `${emoji} Quote ${action}: ${updated.quote_number}`,
          html: `<p>Your quote <strong>${updated.quote_number}</strong> has been <strong>${action}</strong> by the client.</p>`,
        });
      }
    } catch { /* don't block response if email fails */ }
  }

  return NextResponse.json({ ok: true });
}
