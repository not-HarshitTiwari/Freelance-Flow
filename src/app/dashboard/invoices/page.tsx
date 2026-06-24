"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt, Trash2, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type InvoiceItem = { description: string; quantity: number; rate: number };

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst_type: string;
  gst_rate: number;
  total: number;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  notes: string | null;
  terms: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_gstin: string | null;
  customer_name: string | null;
  customer_company: string | null;
  customer_address: string | null;
  customer_gstin: string | null;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
};

type Profile = {
  full_name: string;
  business_name: string;
  business_address: string;
  email: string;
  phone: string;
  gstin: string;
};

const statusColors: Record<string, string> = {
  unpaid: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  paid: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  overdue: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

async function downloadInvoicePdf(inv: Invoice, accentHex: string | null) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const accent: RGB | null = accentHex ? hexToRgb(accentHex) : null;
  const gray: RGB = [100, 100, 100];
  const black: RGB = [30, 30, 30];
  const transparent = !accent;

  // Header bar
  if (accent) {
    doc.setFillColor(...accent);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setDrawColor(220, 220, 220);
    doc.rect(0, 0, 210, 28, "S");
    doc.setTextColor(...black);
  }
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`#${inv.invoice_number}`, 14, 24);

  // Dates top right
  doc.setFontSize(9);
  if (!transparent) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(...black);
  doc.text(`Date: ${inv.invoice_date || ""}`, 140, 14);
  if (inv.due_date) doc.text(`Due: ${inv.due_date}`, 140, 20);
  doc.text(`Status: ${inv.status.toUpperCase()}`, 140, 26);

  // Seller
  doc.setTextColor(...black);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FROM", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  const seller = [
    inv.seller_name,
    inv.seller_address,
    inv.seller_email,
    inv.seller_phone,
    inv.seller_gstin ? `GSTIN: ${inv.seller_gstin}` : null,
  ].filter(Boolean) as string[];
  seller.forEach((line, i) => doc.text(line, 14, 47 + i * 5));

  // Customer
  doc.setTextColor(...black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TO", 110, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  const customer = [
    inv.customer_name,
    inv.customer_company,
    inv.customer_address,
    inv.customer_gstin ? `GSTIN: ${inv.customer_gstin}` : null,
  ].filter(Boolean) as string[];
  customer.forEach((line, i) => doc.text(line, 110, 47 + i * 5));

  // Items table
  const tableStartY = 40 + Math.max(seller.length, customer.length) * 5 + 14;

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]],
    body: inv.items.map((item, i) => [
      i + 1,
      item.description,
      item.quantity,
      item.rate.toLocaleString("en-IN"),
      (item.quantity * item.rate).toLocaleString("en-IN"),
    ]),
    headStyles: { fillColor: accent ?? [240, 240, 240], textColor: accent ? [255, 255, 255] : black, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 15 }, 3: { cellWidth: 28 }, 4: { cellWidth: 30 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Summary box
  const summaryX = 120;
  const rows = [
    ["Subtotal", `₹${inv.subtotal.toLocaleString("en-IN")}`],
    ...(inv.gst_type === "cgst_sgst"
      ? [
          [`CGST (${(inv.gst_rate || 0) / 2}%)`, `₹${(inv.cgst || 0).toLocaleString("en-IN")}`],
          [`SGST (${(inv.gst_rate || 0) / 2}%)`, `₹${(inv.sgst || 0).toLocaleString("en-IN")}`],
        ]
      : [[`IGST (${inv.gst_rate || 0}%)`, `₹${(inv.igst || 0).toLocaleString("en-IN")}`]]),
  ];

  rows.forEach(([label, value], i) => {
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "normal");
    doc.text(label, summaryX, finalY + i * 6);
    doc.text(value, 195, finalY + i * 6, { align: "right" });
  });

  // Total
  const totalY = finalY + rows.length * 6 + 2;
  if (accent) {
    doc.setFillColor(...accent);
    doc.rect(summaryX - 2, totalY - 4, 80, 10, "F");
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.rect(summaryX - 2, totalY - 4, 80, 10, "S");
    doc.setTextColor(...black);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GRAND TOTAL", summaryX, totalY + 3);
  doc.text(`₹${inv.total.toLocaleString("en-IN")}`, 195, totalY + 3, { align: "right" });

  // Payment info
  let infoY = totalY + 16;
  if (inv.payment_method || inv.transaction_id) {
    doc.setTextColor(...black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Payment Info", 14, infoY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    if (inv.payment_method) { doc.text(`Method: ${inv.payment_method}`, 14, infoY + 5); infoY += 5; }
    if (inv.transaction_id) { doc.text(`Transaction ID: ${inv.transaction_id}`, 14, infoY + 5); infoY += 5; }
    infoY += 8;
  }

  if (inv.notes) {
    doc.setTextColor(...black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notes", 14, infoY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text(inv.notes, 14, infoY + 5);
    infoY += 12;
  }

  if (inv.terms) {
    doc.setTextColor(...black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms & Conditions", 14, infoY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text(inv.terms, 14, infoY + 5);
  }

  doc.save(`${inv.invoice_number}.pdf`);
}

const emptyForm = {
  invoice_date: new Date().toISOString().split("T")[0],
  due_date: "",
  gst_type: "cgst_sgst",
  gst_rate: "18",
  payment_method: "",
  transaction_id: "",
  notes: "",
  terms: "Payment due within 15 days of invoice date.",
  seller_name: "", seller_address: "", seller_email: "", seller_phone: "", seller_gstin: "",
  customer_name: "", customer_company: "", customer_address: "", customer_gstin: "",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [pdfColor, setPdfColor] = useState<string | null>("#7c3aed");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [form, setForm] = useState(emptyForm);

  const fetchInvoices = useCallback(async () => {
    const res = await fetch("/api/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetch("/api/profile").then(r => r.json()).then(({ profile }: { profile: Profile }) => {
      if (profile) setForm(f => ({
        ...f,
        seller_name: profile.business_name || profile.full_name || "",
        seller_address: profile.business_address || "",
        seller_email: profile.email || "",
        seller_phone: profile.phone || "",
        seller_gstin: profile.gstin || "",
      }));
    });
    // Fetch saved clients
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).order("name");
        setClients(data || []);
      });
    });
  }, [fetchInvoices]);

  function selectClient(id: string) {
    const c = clients.find(cl => cl.id === id);
    if (!c) return;
    setForm(f => ({
      ...f,
      customer_name: c.name,
      customer_company: c.company || "",
      customer_address: c.address || "",
      customer_gstin: "",
    }));
  }

  function addItem() { setItems([...items, { description: "", quantity: 1, rate: 0 }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    const u = [...items];
    u[i] = { ...u[i], [field]: value };
    setItems(u);
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const gstAmt = (subtotal * parseFloat(form.gst_rate || "0")) / 100;
  const total = subtotal + gstAmt;
  const halfGst = gstAmt / 2;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, gst_rate: parseFloat(form.gst_rate), items }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Invoice ${data.invoice.invoice_number} created!`);
      setOpen(false);
      setItems([{ description: "", quantity: 1, rate: 0 }]);
      fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    await fetch("/api/invoices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Invoice deleted");
    fetchInvoices();
  }

  async function markPaid(id: string) {
    await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "paid" }),
    });
    toast.success("Marked as paid!");
    fetchInvoices();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create GST-compliant invoices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Plus size={16} /> New Invoice
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Invoice Date</Label>
                  <Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>

              {/* Seller */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Seller Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Business Name</Label>
                    <Input placeholder="Markwings" value={form.seller_name} onChange={e => setForm({ ...form, seller_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input placeholder="Mumbai, India" value={form.seller_address} onChange={e => setForm({ ...form, seller_address: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" placeholder="hello@markwings.com" value={form.seller_email} onChange={e => setForm({ ...form, seller_email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input placeholder="+91 98765 43210" value={form.seller_phone} onChange={e => setForm({ ...form, seller_phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>GSTIN (optional)</Label>
                    <Input placeholder="22AAAAA0000A1Z5" value={form.seller_gstin} onChange={e => setForm({ ...form, seller_gstin: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Customer Details</p>
                </div>
                {clients.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Select from saved clients</Label>
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none"
                      defaultValue=""
                      onChange={e => selectClient(e.target.value)}
                    >
                      <option value="">— Pick a client —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.company ? ` (${c.company})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Customer Name *</Label>
                    <Input placeholder="Rahul Sharma" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name</Label>
                    <Input placeholder="ABC Pvt Ltd" value={form.customer_company} onChange={e => setForm({ ...form, customer_company: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Billing Address</Label>
                    <Input placeholder="Delhi, India" value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer GSTIN (B2B)</Label>
                    <Input placeholder="27AAAAA0000A1Z5" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Line Items</p>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} required />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Qty" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" placeholder="Rate ₹" min={0} value={item.rate} onChange={e => updateItem(i, "rate", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 text-right text-xs text-gray-500 dark:text-gray-400">
                      ₹{(item.quantity * item.rate).toLocaleString("en-IN")}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-violet-600 text-sm hover:underline">
                  <Plus size={14} /> Add Item
                </button>
              </div>

              {/* Tax */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Tax Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>GST Type</Label>
                    <select value={form.gst_type} onChange={e => setForm({ ...form, gst_type: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                      <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
                      <option value="igst">IGST (Inter-state)</option>
                      <option value="none">No GST</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>GST Rate (%)</Label>
                    <select value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1.5 mt-2">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                  {form.gst_type === "cgst_sgst" && <>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({parseFloat(form.gst_rate) / 2}%)</span><span>₹{halfGst.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({parseFloat(form.gst_rate) / 2}%)</span><span>₹{halfGst.toLocaleString("en-IN")}</span></div>
                  </>}
                  {form.gst_type === "igst" && <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({form.gst_rate}%)</span><span>₹{gstAmt.toLocaleString("en-IN")}</span></div>}
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1.5"><span>Grand Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
                </div>
              </div>

              {/* Payment */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Payment Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                      <option value="">Select...</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transaction ID</Label>
                    <Input placeholder="TXN123456" value={form.transaction_id} onChange={e => setForm({ ...form, transaction_id: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Notes / Remarks</Label>
                  <Textarea placeholder="Thank you for your business!" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Terms & Conditions</Label>
                  <Textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} />
                </div>
              </div>

              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={saving}>
                {saving ? "Creating..." : "Create Invoice"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Receipt size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No invoices yet</p>
          <p className="text-sm">Create your first GST invoice</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(inv)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{inv.invoice_number}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {inv.customer_name || inv.customer_company || "No customer"} •{" "}
                    {new Date(inv.invoice_date || inv.created_at).toLocaleDateString("en-IN")}
                    {inv.due_date && ` • Due ${new Date(inv.due_date).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-white">₹{inv.total.toLocaleString("en-IN")}</span>
                  <Badge className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                  <button
                    onClick={e => { e.stopPropagation(); downloadInvoicePdf(inv, pdfColor); }}
                    className="text-gray-400 hover:text-violet-600"
                    title="Download PDF"
                  >
                    <Download size={16} />
                  </button>
                  {inv.status === "unpaid" && (
                    <button
                      onClick={e => { e.stopPropagation(); markPaid(inv.id); }}
                      className="text-gray-400 hover:text-green-600"
                      title="Mark as paid"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteInvoice(inv.id); }}
                    className="text-gray-400 hover:text-red-600"
                    title="Delete invoice"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Invoice Dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="text-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">From</p>
                  <p className="font-medium dark:text-white">{selected.seller_name}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selected.seller_address}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selected.seller_email}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selected.seller_phone}</p>
                  {selected.seller_gstin && <p className="text-gray-500 dark:text-gray-400">GSTIN: {selected.seller_gstin}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">To</p>
                  <p className="font-medium dark:text-white">{selected.customer_name}</p>
                  {selected.customer_company && <p className="text-gray-500 dark:text-gray-400">{selected.customer_company}</p>}
                  <p className="text-gray-500 dark:text-gray-400">{selected.customer_address}</p>
                  {selected.customer_gstin && <p className="text-gray-500 dark:text-gray-400">GSTIN: {selected.customer_gstin}</p>}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Amount</th>
                </tr></thead>
                <tbody>{selected.items.map((item, i) => (
                  <tr key={i} className="border-b dark:border-gray-700 dark:text-gray-300">
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">₹{item.rate.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right">₹{(item.quantity * item.rate).toLocaleString("en-IN")}</td>
                  </tr>
                ))}</tbody>
              </table>

              <div className="space-y-1 text-right">
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{selected.subtotal.toLocaleString("en-IN")}</span></div>
                {selected.gst_type === "cgst_sgst" ? <>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({selected.gst_rate / 2}%)</span><span>₹{selected.cgst?.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({selected.gst_rate / 2}%)</span><span>₹{selected.sgst?.toLocaleString("en-IN")}</span></div>
                </> : selected.gst_type === "igst" ? (
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({selected.gst_rate}%)</span><span>₹{selected.igst?.toLocaleString("en-IN")}</span></div>
                ) : null}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1"><span>Grand Total</span><span>₹{selected.total.toLocaleString("en-IN")}</span></div>
              </div>

              {(selected.payment_method || selected.transaction_id) && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-1">
                  <p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase">Payment</p>
                  {selected.payment_method && <p>Method: {selected.payment_method}</p>}
                  {selected.transaction_id && <p>Transaction ID: {selected.transaction_id}</p>}
                  <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
                </div>
              )}

              {selected.notes && <div><p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Notes</p><p className="text-gray-500 dark:text-gray-400">{selected.notes}</p></div>}
              {selected.terms && <div><p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Terms</p><p className="text-gray-500 dark:text-gray-400">{selected.terms}</p></div>}
            </div>

            {/* PDF Color Picker */}
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">PDF Accent Color</p>
              <div className="flex items-center gap-2 flex-wrap">
                {["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#db2777","#000000"].map(c => (
                  <button
                    key={c}
                    onClick={() => setPdfColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: pdfColor === c ? "#000" : "transparent" }}
                    title={c}
                  />
                ))}
                {/* Custom color */}
                <label className="relative w-7 h-7 rounded-full border-2 border-gray-300 overflow-hidden cursor-pointer" title="Custom color">
                  <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" value={pdfColor ?? "#ffffff"} onChange={e => setPdfColor(e.target.value)} />
                  <span className="flex items-center justify-center w-full h-full text-xs text-gray-400">+</span>
                </label>
                {/* Transparent */}
                <button
                  onClick={() => setPdfColor(null)}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs text-gray-400 transition-all ${pdfColor === null ? "border-black" : "border-gray-300"}`}
                  title="Transparent (no color)"
                  style={{ background: "repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 6px)" }}
                />
              </div>
            </div>

            <Button onClick={() => downloadInvoicePdf(selected, pdfColor)} className="w-full mt-3 bg-violet-600 hover:bg-violet-700 gap-2">
              <Download size={16} /> Download PDF
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
