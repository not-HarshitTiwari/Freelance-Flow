import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceId, toEmail, toName, message, pdfBase64 } = await request.json();
  if (!invoiceId || !toEmail) {
    return NextResponse.json({ error: "Missing invoiceId or toEmail" }, { status: 400 });
  }

  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("smtp_email, smtp_password, full_name, business_name, plan").eq("id", user.id).single(),
  ]);

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (!["pro", "advanced"].includes(profile?.plan || "")) {
    return NextResponse.json({ error: "Email sending requires a Pro or Advanced plan." }, { status: 403 });
  }
  if (!profile?.smtp_email || !profile?.smtp_password) {
    return NextResponse.json({ error: "SMTP not configured. Add Gmail credentials in Settings." }, { status: 400 });
  }

  const senderName = profile.business_name || profile.full_name || "Freelancer";

  // Build payment section HTML
  const methods: string[] = invoice.payment_methods || (invoice.payment_method ? [invoice.payment_method] : []);
  let paymentHtml = "";
  if (methods.length > 0) {
    paymentHtml += `<p style="margin:0 0 6px"><strong>Payment Method${methods.length > 1 ? "s" : ""}:</strong> ${methods.join(", ")}</p>`;
  }
  if (invoice.upi_id && methods.some((m: string) => m === "UPI")) {
    paymentHtml += `<p style="margin:0 0 6px"><strong>UPI ID:</strong> ${invoice.upi_id}</p>`;
  }
  if (methods.some((m: string) => m === "Bank Transfer") && invoice.bank_account_number) {
    paymentHtml += `
      <p style="margin:0 0 4px"><strong>Bank Details:</strong></p>
      <p style="margin:0 0 2px">Account Name: ${invoice.bank_account_name || ""}</p>
      <p style="margin:0 0 2px">Account Number: ${invoice.bank_account_number}</p>
      <p style="margin:0 0 2px">IFSC: ${invoice.bank_ifsc || ""}</p>
      <p style="margin:0 0 2px">Bank: ${invoice.bank_name || ""}</p>
    `;
  }
  if (invoice.transaction_id) {
    paymentHtml += `<p style="margin:0 0 6px"><strong>Transaction ID:</strong> ${invoice.transaction_id}</p>`;
  }

  // Build items table rows
  const itemRows = (invoice.items as { description: string; quantity: number; rate: number }[])
    .map(it => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0">${it.description}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right">₹${it.rate.toLocaleString("en-IN")}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right">₹${(it.quantity * it.rate).toLocaleString("en-IN")}</td>
      </tr>
    `).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1f2937">
  <div style="background:#7c3aed;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:22px">Invoice ${invoice.invoice_number}</h1>
    <p style="margin:4px 0 0;color:#ddd6fe;font-size:13px">From ${senderName}</p>
  </div>

  <div style="border:1px solid #e5e7eb;border-top:none;padding:28px 32px;border-radius:0 0 8px 8px">
    ${message ? `<p style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:12px 16px;border-radius:4px;margin:0 0 24px;color:#4c1d95">${message}</p>` : ""}

    <div style="display:flex;justify-content:space-between;margin-bottom:24px">
      <div>
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#9ca3af;font-weight:600">From</p>
        <p style="margin:0;font-weight:600">${invoice.seller_name || senderName}</p>
        ${invoice.seller_address ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">${invoice.seller_address}</p>` : ""}
        ${invoice.seller_email ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">${invoice.seller_email}</p>` : ""}
        ${invoice.seller_phone ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">${invoice.seller_phone}</p>` : ""}
        ${invoice.seller_gstin ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">GSTIN: ${invoice.seller_gstin}</p>` : ""}
      </div>
      <div style="text-align:right">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#9ca3af;font-weight:600">To</p>
        <p style="margin:0;font-weight:600">${invoice.customer_name || toName || ""}</p>
        ${invoice.customer_company ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">${invoice.customer_company}</p>` : ""}
        ${invoice.customer_address ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">${invoice.customer_address}</p>` : ""}
        ${invoice.customer_gstin ? `<p style="margin:2px 0;color:#6b7280;font-size:13px">GSTIN: ${invoice.customer_gstin}</p>` : ""}
      </div>
    </div>

    <div style="display:flex;gap:24px;margin-bottom:24px">
      <p style="margin:0;font-size:13px;color:#6b7280">Date: <strong>${invoice.invoice_date || ""}</strong></p>
      ${invoice.due_date ? `<p style="margin:0;font-size:13px;color:#6b7280">Due: <strong>${invoice.due_date}</strong></p>` : ""}
      <p style="margin:0;font-size:13px;color:#6b7280">Status: <strong style="color:${invoice.status === "paid" ? "#16a34a" : "#d97706"}">${invoice.status.toUpperCase()}</strong></p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead>
        <tr style="background:#f5f3ff">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#7c3aed">Description</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#7c3aed">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#7c3aed">Rate</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#7c3aed">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="text-align:right;margin-bottom:20px">
      <p style="margin:4px 0;color:#6b7280;font-size:13px">Subtotal: ₹${invoice.subtotal.toLocaleString("en-IN")}</p>
      ${invoice.gst_type === "cgst_sgst" ? `
        <p style="margin:4px 0;color:#6b7280;font-size:13px">CGST (${(invoice.gst_rate || 0) / 2}%): ₹${(invoice.cgst || 0).toLocaleString("en-IN")}</p>
        <p style="margin:4px 0;color:#6b7280;font-size:13px">SGST (${(invoice.gst_rate || 0) / 2}%): ₹${(invoice.sgst || 0).toLocaleString("en-IN")}</p>
      ` : invoice.gst_type === "igst" ? `
        <p style="margin:4px 0;color:#6b7280;font-size:13px">IGST (${invoice.gst_rate || 0}%): ₹${(invoice.igst || 0).toLocaleString("en-IN")}</p>
      ` : ""}
      <div style="background:#7c3aed;color:#fff;padding:10px 16px;border-radius:6px;display:inline-block;margin-top:8px">
        <strong>Grand Total: ₹${invoice.total.toLocaleString("en-IN")}</strong>
      </div>
    </div>

    ${paymentHtml ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;color:#9ca3af;font-weight:600">Payment Details</p>
      ${paymentHtml}
    </div>
    ` : ""}

    ${invoice.notes ? `<p style="color:#6b7280;font-size:13px"><strong>Notes:</strong> ${invoice.notes}</p>` : ""}
    ${invoice.terms ? `<p style="color:#6b7280;font-size:13px"><strong>Terms:</strong> ${invoice.terms}</p>` : ""}

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px"/>
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent via FreelanceFlow</p>
  </div>
</div>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: profile.smtp_email, pass: profile.smtp_password },
    });

    const attachments = pdfBase64
      ? [{ filename: `Invoice-${invoice.invoice_number}.pdf`, content: Buffer.from(pdfBase64.split(",")[1], "base64"), contentType: "application/pdf" }]
      : [];

    await transporter.sendMail({
      from: `"${senderName}" <${profile.smtp_email}>`,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject: `Invoice ${invoice.invoice_number} from ${senderName}`,
      html,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to send: ${msg}` }, { status: 500 });
  }
}
