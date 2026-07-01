import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { applyStockChange, type StockItem } from "@/lib/stock";
import { getWorkspaceOwnerId } from "@/lib/team";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { id } = await params;

  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (fetchError || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.converted_invoice_id) {
    return NextResponse.json({ error: "Quote already converted to an invoice" }, { status: 409 });
  }

  const invoiceNumber = await generateInvoiceNumber(supabase, ownerId);

  const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
    user_id: ownerId,
    client_id: quote.client_id,
    invoice_number: invoiceNumber,
    invoice_date: new Date().toISOString().split("T")[0],
    items: quote.items,
    subtotal: quote.subtotal,
    tax: (quote.cgst || 0) + (quote.sgst || 0) + (quote.igst || 0),
    cgst: quote.cgst, sgst: quote.sgst, igst: quote.igst,
    gst_type: quote.gst_type, gst_rate: quote.gst_rate,
    total: quote.total,
    status: "unpaid",
    notes: quote.notes,
    terms: quote.terms,
    seller_name: quote.seller_name, seller_address: quote.seller_address, seller_email: quote.seller_email,
    seller_phone: quote.seller_phone, seller_gstin: quote.seller_gstin,
    customer_name: quote.customer_name, customer_company: quote.customer_company,
    customer_address: quote.customer_address, customer_gstin: quote.customer_gstin,
    customer_email: quote.customer_email,
  }).select("*").single();

  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ status: "converted", converted_invoice_id: invoice.id })
    .eq("id", id)
    .eq("user_id", ownerId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const stockErrors = await applyStockChange(supabase, quote.items as StockItem[], 1);

  return NextResponse.json({ invoice, ...(stockErrors.length ? { stock_warning: "Invoice created, but some stock counts couldn't be updated automatically." } : {}) });
}
