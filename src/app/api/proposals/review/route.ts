import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST — generate review token for a proposal
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await req.json();
  const token = randomBytes(32).toString("hex");

  const { error } = await supabase.from("proposals")
    .update({ review_token: token })
    .eq("id", proposalId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}

// GET — fetch proposal by review token (public — RLS allows SELECT when review_token IS NOT NULL)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, title, content, status, amount, created_at")
    .eq("review_token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  return NextResponse.json({ proposal: data });
}

// PATCH — client accepts or rejects (one-time only — RLS allows SELECT when review_token IS NOT NULL)
export async function PATCH(req: Request) {
  const { token, action } = await req.json();
  if (!token || !["accepted", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("proposals")
    .select("status")
    .eq("review_token", token)
    .single();

  if (!existing) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (existing.status === "accepted" || existing.status === "rejected") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("proposals")
    .update({ status: action })
    .eq("review_token", token)
    .select("user_id, title")
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
          subject: `${emoji} Proposal ${action}: ${updated.title}`,
          html: `<p>Your proposal <strong>${updated.title}</strong> has been <strong>${action}</strong> by the client.</p>`,
        });
      }
    } catch { /* don't block response if email fails */ }
  }

  return NextResponse.json({ ok: true });
}
