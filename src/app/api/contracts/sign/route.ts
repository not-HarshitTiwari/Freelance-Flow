import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, title, client_name, body, status, signed_at")
    .eq("sign_token", token)
    .single();
  if (error || !data) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  return NextResponse.json({ contract: data });
}

export async function POST(request: Request) {
  const { token, signature } = await request.json();
  if (!token || !signature) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ client_signature: signature, signed_at: new Date().toISOString(), status: "signed" })
    .eq("sign_token", token)
    .eq("status", "sent")
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not sign contract" }, { status: 400 });

  // Notify the freelancer by email
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("smtp_email, smtp_password")
      .eq("id", data.user_id)
      .single();
    if (profile?.smtp_email && profile?.smtp_password) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: profile.smtp_email, pass: profile.smtp_password },
      });
      await transporter.sendMail({
        from: profile.smtp_email,
        to: profile.smtp_email,
        subject: `✅ Contract signed: ${data.title}`,
        html: `<p><strong>${data.client_name}</strong> has signed the contract <em>${data.title}</em>.</p><p>Signed at: ${new Date().toLocaleString("en-IN")}</p>`,
      });
    }
  } catch { /* email failure should not break the response */ }

  return NextResponse.json({ success: true });
}
