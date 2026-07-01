import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { data } = await supabase.from("contracts").select("*").eq("user_id", ownerId).order("created_at", { ascending: false });
  return NextResponse.json({ contracts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", ownerId).single();
  if (!profile?.plan || !["basic", "pro", "advanced"].includes(profile.plan)) {
    return NextResponse.json({ error: "Contracts require a Basic plan or higher." }, { status: 403 });
  }

  const { title, client_name, client_email, body } = await request.json();
  const { data, error } = await supabase.from("contracts")
    .insert({ title, client_name: client_name || null, client_email: client_email || null, body, user_id: ownerId })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { id, title, client_name, client_email, body, status } = await request.json();

  if (status === "sent") {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", ownerId).single();
    if (!profile?.plan || !["basic", "pro", "advanced"].includes(profile.plan)) {
      return NextResponse.json({ error: "Sending contracts requires a Basic plan or higher." }, { status: 403 });
    }
  }

  // Whitelist updatable fields — never allow sign_token, client_signature, signed_at, user_id
  const updates: Record<string, string | null> = {};
  if (title !== undefined) updates.title = title;
  if (client_name !== undefined) updates.client_name = client_name || null;
  if (client_email !== undefined) updates.client_email = client_email || null;
  if (body !== undefined) updates.body = body;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase.from("contracts")
    .update(updates).eq("id", id).eq("user_id", ownerId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send signing email when status changes to "sent" and client has email
  if (status === "sent" && data.client_email) {
    try {
      const { data: profile } = await supabase.from("profiles")
        .select("smtp_email, smtp_password, full_name, business_name")
        .eq("id", ownerId).single();
      if (profile?.smtp_email && profile?.smtp_password) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
          || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const signingLink = `${appUrl}/sign/${data.sign_token}`;
        const senderName = profile.business_name || profile.full_name || "Your Freelancer";
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: profile.smtp_email, pass: profile.smtp_password },
        });
        await transporter.sendMail({
          from: `"${senderName}" <${profile.smtp_email}>`,
          to: data.client_email,
          subject: `Please sign: ${data.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;">
              <h2 style="color:#7c3aed;">Contract Signing Request</h2>
              <p>Hi ${data.client_name || "there"},</p>
              <p><strong>${senderName}</strong> has shared a contract for your review and signature:</p>
              <p style="font-size:16px;font-weight:bold;color:#1f2937">${data.title}</p>
              <p style="margin:24px 0;">
                <a href="${signingLink}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
                  Review &amp; Sign Contract
                </a>
              </p>
              <p style="color:#6b7280;font-size:13px;">Or copy this link:<br/>${signingLink}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
              <p style="color:#9ca3af;font-size:11px;">Sent via FreelanceFlow</p>
            </div>
          `,
        });
      }
    } catch { /* email failure must not fail the response */ }
  }

  return NextResponse.json({ contract: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { id } = await request.json();
  const { error } = await supabase.from("contracts").delete().eq("id", id).eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
