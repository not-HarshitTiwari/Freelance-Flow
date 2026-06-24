import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId, toEmail, toName } = await request.json();
  if (!proposalId || !toEmail) {
    return NextResponse.json({ error: "Missing proposalId or toEmail" }, { status: 400 });
  }

  // Get proposal
  const { data: proposal, error: pErr } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("user_id", user.id)
    .single();

  if (pErr || !proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  // Get profile with SMTP credentials
  const { data: profile } = await supabase
    .from("profiles")
    .select("smtp_email, smtp_password, full_name, business_name")
    .eq("id", user.id)
    .single();

  if (!profile?.smtp_email || !profile?.smtp_password) {
    return NextResponse.json({ error: "SMTP credentials not configured. Please add them in Settings." }, { status: 400 });
  }

  const senderName = profile.business_name || profile.full_name || "Freelancer";

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: profile.smtp_email,
      pass: profile.smtp_password,
    },
  });

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1f2937">
      <h2 style="color:#7c3aed;margin-bottom:4px">${proposal.title}</h2>
      <p style="color:#6b7280;margin-top:0;font-size:14px">From ${senderName}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
      <div style="white-space:pre-wrap;line-height:1.7;font-size:15px">${proposal.content.replace(/\n/g, "<br/>")}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px"/>
      <p style="color:#9ca3af;font-size:12px">Sent via FreelanceFlow</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${senderName}" <${profile.smtp_email}>`,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject: proposal.title,
      html: htmlContent,
    });

    // Update proposal status to "sent"
    await supabase.from("proposals").update({ status: "sent" }).eq("id", proposalId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("SMTP error:", msg);
    return NextResponse.json({ error: `Failed to send email: ${msg}` }, { status: 500 });
  }
}
