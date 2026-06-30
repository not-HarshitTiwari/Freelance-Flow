import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { applyStockChange, type StockItem } from "@/lib/stock";

// Vercel cron calls this every day at 8am IST
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Find recurring invoices due today or earlier
  const { data: recurringInvoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("is_recurring", true)
    .lte("next_invoice_date", today)
    .not("next_invoice_date", "is", null);

  if (!recurringInvoices?.length) return NextResponse.json({ created: 0 });

  let created = 0;

  for (const inv of recurringInvoices) {
    const newDate = new Date();
    const newDueDate = inv.due_date
      ? new Date(newDate.getTime() + (new Date(inv.due_date).getTime() - new Date(inv.invoice_date || inv.created_at).getTime()))
      : null;

    const invoiceNumber = await generateInvoiceNumber(supabase, inv.user_id);

    const { error } = await supabase.from("invoices").insert({
      user_id: inv.user_id,
      invoice_number: invoiceNumber,
      invoice_date: today,
      due_date: newDueDate?.toISOString().slice(0, 10) ?? null,
      seller_name: inv.seller_name,
      seller_email: inv.seller_email,
      seller_phone: inv.seller_phone,
      seller_address: inv.seller_address,
      seller_gstin: inv.seller_gstin,
      customer_name: inv.customer_name,
      customer_email: inv.customer_email,
      customer_company: inv.customer_company,
      customer_address: inv.customer_address,
      customer_gstin: inv.customer_gstin,
      items: inv.items,
      subtotal: inv.subtotal,
      tax: inv.tax,
      cgst: inv.cgst,
      sgst: inv.sgst,
      igst: inv.igst,
      gst_type: inv.gst_type,
      gst_rate: inv.gst_rate,
      total: inv.total,
      notes: inv.notes,
      terms: inv.terms,
      payment_method: inv.payment_method,
      payment_methods: inv.payment_methods,
      upi_id: inv.upi_id,
      bank_account_name: inv.bank_account_name,
      bank_account_number: inv.bank_account_number,
      bank_ifsc: inv.bank_ifsc,
      bank_name: inv.bank_name,
      status: "unpaid",
      is_recurring: false,
    });

    if (!error) {
      await applyStockChange(supabase, inv.items as StockItem[], 1);

      const next = new Date();
      const interval = inv.recurrence_interval || "monthly";
      if (interval === "weekly") next.setDate(next.getDate() + 7);
      else if (interval === "quarterly") next.setMonth(next.getMonth() + 3);
      else next.setMonth(next.getMonth() + 1);

      await supabase.from("invoices")
        .update({ next_invoice_date: next.toISOString().slice(0, 10) })
        .eq("id", inv.id);

      created++;
    }
  }

  return NextResponse.json({ created });
}
