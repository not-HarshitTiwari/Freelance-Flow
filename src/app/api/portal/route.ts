import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";

// POST — generate portal token for a client, optionally email the link
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { clientId, sendEmail: doEmail } = await req.json();
  const token = randomBytes(32).toString("hex");

  const { error } = await supabase.from("client_portals").upsert(
    { user_id: ownerId, client_id: clientId, token },
    { onConflict: "client_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (doEmail) {
    const [{ data: client }, { data: profile }] = await Promise.all([
      supabase.from("clients").select("name, email").eq("id", clientId).single(),
      supabase.from("profiles").select("smtp_email, smtp_password, business_name, full_name").eq("id", ownerId).single(),
    ]);
    if (client?.email && profile?.smtp_email && profile?.smtp_password) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const portalUrl = `${appUrl}/portal/${token}`;
        const senderName = profile.business_name || profile.full_name || "Your Freelancer";
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: profile.smtp_email, pass: profile.smtp_password },
        });
        await transporter.sendMail({
          from: `"${senderName}" <${profile.smtp_email}>`,
          to: client.email,
          subject: `Your client portal — ${senderName}`,
          html: `<p>Hi ${client.name},</p><p>You can view your invoices and proposals here:</p><p><a href="${portalUrl}" style="color:#7c3aed;font-weight:bold">${portalUrl}</a></p><p>— ${senderName}</p>`,
        });
      } catch { /* don't fail if email fails */ }
    }
  }

  return NextResponse.json({ token });
}

// GET — fetch portal data by token (public, uses admin to bypass RLS)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: portal } = await supabase
    .from("client_portals")
    .select("client_id, user_id")
    .eq("token", token)
    .single();

  if (!portal) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const [{ data: clientData }, { data: freelancerProfile }] = await Promise.all([
    supabase.from("clients").select("name, email, company").eq("id", portal.client_id).single(),
    supabase.from("profiles").select("plan").eq("id", portal.user_id).single(),
  ]);

  const orParts = [
    clientData?.email ? `customer_email.ilike.${clientData.email}` : null,
    clientData?.name ? `customer_name.ilike.${clientData.name}` : null,
  ].filter(Boolean) as string[];

  let invoicesQuery = supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, total, status, items, subtotal, tax, cgst, sgst, igst, gst_type, gst_rate, payment_method, payment_methods, upi_id, bank_account_name, bank_account_number, bank_ifsc, bank_name, transaction_id, notes, terms, seller_name, seller_address, seller_email, seller_phone, seller_gstin, customer_name, customer_company, customer_address, customer_gstin, payment_link, amount_paid")
    .eq("user_id", portal.user_id)
    .order("created_at", { ascending: false });

  if (orParts.length > 0) invoicesQuery = invoicesQuery.or(orParts.join(","));
  else invoicesQuery = invoicesQuery.eq("id", "00000000-0000-0000-0000-000000000000");

  const { data: invoices } = await invoicesQuery;

  let proposalsQuery = supabase
    .from("proposals")
    .select("id, title, status, created_at, project_type")
    .eq("user_id", portal.user_id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (clientData?.name) proposalsQuery = proposalsQuery.ilike("title", `%${clientData.name}%`);
  const { data: proposals } = await proposalsQuery;

  // Split invoices: unpaid/partial first, paid at the bottom (separate key so UI can collapse)
  const unpaidInvoices = (invoices ?? []).filter(i => i.status !== "paid");
  const paidInvoices = (invoices ?? []).filter(i => i.status === "paid");

  return NextResponse.json({ client: clientData, invoices: unpaidInvoices, paidInvoices, proposals, freelancerPlan: freelancerProfile?.plan || "free" });
}
