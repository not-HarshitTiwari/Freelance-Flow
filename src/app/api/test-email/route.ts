import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getWorkspaceOwnerId } from "@/lib/team";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("smtp_email, smtp_password, full_name, business_name")
    .eq("id", ownerId)
    .single();

  if (!profile?.smtp_email || !profile?.smtp_password) {
    return NextResponse.json({ error: "No SMTP credentials saved. Save your Gmail address and app password first." }, { status: 400 });
  }

  const senderName = profile.business_name || profile.full_name || "FreelanceFlow";

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: profile.smtp_email, pass: profile.smtp_password },
    });

    await transporter.sendMail({
      from: `"${senderName}" <${profile.smtp_email}>`,
      to: profile.smtp_email,
      subject: "FreelanceFlow — SMTP Test",
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;"><h2 style="color:#7c3aed;">Email Test Successful ✓</h2><p>Hi ${senderName},</p><p>Your Gmail SMTP is configured correctly. Invoices, reminders, and quotes sent from FreelanceFlow will use <strong>${profile.smtp_email}</strong> as the sender.</p><p style="color:#666;font-size:13px;margin-top:20px;">Sent by FreelanceFlow</p></div>`,
    });

    return NextResponse.json({ success: true, to: profile.smtp_email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `SMTP test failed: ${msg}` }, { status: 500 });
  }
}
