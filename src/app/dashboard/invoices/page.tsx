"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt, Trash2, Download, CheckCircle, Send, Pencil } from "lucide-react";
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
  payment_methods: string[] | null;
  payment_method: string | null;
  transaction_id: string | null;
  upi_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  notes: string | null;
  terms: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_gstin: string | null;
  customer_name: string | null;
  customer_email: string | null;
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
  upi_id: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
};

const PAYMENT_OPTIONS = ["UPI", "Bank Transfer", "Card", "Cash", "Cheque"];

const statusColors: Record<string, string> = {
  unpaid: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  paid: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  overdue: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

type RGB = [number, number, number];
function hexToRgb(hex: string): RGB {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

async function downloadInvoicePdf(inv: Invoice, accentHex: string | null) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const accent: RGB | null = accentHex ? hexToRgb(accentHex) : null;
  const gray: RGB = [100, 100, 100];
  const black: RGB = [30, 30, 30];
  const transparent = !accent;

  if (accent) {
    doc.setFillColor(...accent);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setDrawColor(220, 220, 220);
    doc.rect(0, 0, 210, 28, "S");
    doc.setTextColor(...black);
  }
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 14, 18);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`#${inv.invoice_number}`, 14, 24);
  doc.setFontSize(9);
  if (!transparent) doc.setTextColor(255, 255, 255); else doc.setTextColor(...black);
  doc.text(`Date: ${inv.invoice_date || ""}`, 140, 14);
  if (inv.due_date) doc.text(`Due: ${inv.due_date}`, 140, 20);
  doc.text(`Status: ${inv.status.toUpperCase()}`, 140, 26);

  doc.setTextColor(...black); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("FROM", 14, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...gray);
  const seller = [inv.seller_name, inv.seller_address, inv.seller_email, inv.seller_phone, inv.seller_gstin ? `GSTIN: ${inv.seller_gstin}` : null].filter(Boolean) as string[];
  seller.forEach((line, i) => doc.text(line, 14, 47 + i * 5));

  doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TO", 110, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...gray);
  const customer = [inv.customer_name, inv.customer_company, inv.customer_address, inv.customer_gstin ? `GSTIN: ${inv.customer_gstin}` : null].filter(Boolean) as string[];
  customer.forEach((line, i) => doc.text(line, 110, 47 + i * 5));

  const tableStartY = 40 + Math.max(seller.length, customer.length) * 5 + 14;
  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]],
    body: inv.items.map((item, i) => [i + 1, item.description, item.quantity, item.rate.toLocaleString("en-IN"), (item.quantity * item.rate).toLocaleString("en-IN")]),
    headStyles: { fillColor: accent ?? [240, 240, 240], textColor: accent ? [255, 255, 255] : black, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 15 }, 3: { cellWidth: 28 }, 4: { cellWidth: 30 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const summaryX = 120;
  const rows = [
    ["Subtotal", `₹${inv.subtotal.toLocaleString("en-IN")}`],
    ...(inv.gst_type === "cgst_sgst"
      ? [[`CGST (${(inv.gst_rate||0)/2}%)`, `₹${(inv.cgst||0).toLocaleString("en-IN")}`], [`SGST (${(inv.gst_rate||0)/2}%)`, `₹${(inv.sgst||0).toLocaleString("en-IN")}`]]
      : [[`IGST (${inv.gst_rate||0}%)`, `₹${(inv.igst||0).toLocaleString("en-IN")}`]]),
  ];
  rows.forEach(([label, value], i) => {
    doc.setFontSize(9); doc.setTextColor(...gray); doc.setFont("helvetica", "normal");
    doc.text(label, summaryX, finalY + i * 6);
    doc.text(value, 195, finalY + i * 6, { align: "right" });
  });

  const totalY = finalY + rows.length * 6 + 2;
  if (accent) { doc.setFillColor(...accent); doc.rect(summaryX - 2, totalY - 4, 80, 10, "F"); doc.setTextColor(255, 255, 255); }
  else { doc.setDrawColor(200, 200, 200); doc.rect(summaryX - 2, totalY - 4, 80, 10, "S"); doc.setTextColor(...black); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("GRAND TOTAL", summaryX, totalY + 3);
  doc.text(`₹${inv.total.toLocaleString("en-IN")}`, 195, totalY + 3, { align: "right" });

  let infoY = totalY + 16;
  const methods = inv.payment_methods?.length ? inv.payment_methods : inv.payment_method ? [inv.payment_method] : [];
  if (methods.length || inv.upi_id || inv.bank_account_number || inv.transaction_id) {
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Payment Information", 14, infoY); infoY += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    if (methods.length) { doc.text(`Method: ${methods.join(", ")}`, 14, infoY); infoY += 5; }
    if (methods.includes("UPI") && inv.upi_id) { doc.text(`UPI ID: ${inv.upi_id}`, 14, infoY); infoY += 5; }
    if (methods.includes("Bank Transfer") && inv.bank_account_number) {
      doc.text(`Account Name: ${inv.bank_account_name || ""}`, 14, infoY); infoY += 5;
      doc.text(`Account Number: ${inv.bank_account_number}`, 14, infoY); infoY += 5;
      doc.text(`IFSC: ${inv.bank_ifsc || ""}  |  Bank: ${inv.bank_name || ""}`, 14, infoY); infoY += 5;
    }
    if (inv.transaction_id) { doc.text(`Transaction ID: ${inv.transaction_id}`, 14, infoY); infoY += 5; }
    infoY += 4;
  }

  if (inv.notes) {
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Notes", 14, infoY); doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    doc.text(inv.notes, 14, infoY + 5); infoY += 12;
  }
  if (inv.terms) {
    doc.setTextColor(...black); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Terms & Conditions", 14, infoY); doc.setFont("helvetica", "normal"); doc.setTextColor(...gray);
    doc.text(inv.terms, 14, infoY + 5);
  }

  doc.save(`${inv.invoice_number}.pdf`);
}

const emptyForm = {
  invoice_date: new Date().toISOString().split("T")[0],
  due_date: "",
  gst_type: "cgst_sgst",
  gst_rate: "18",
  payment_methods: [] as string[],
  transaction_id: "",
  upi_id: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
  notes: "",
  terms: "Payment due within 15 days of invoice date.",
  seller_name: "", seller_address: "", seller_email: "", seller_phone: "", seller_gstin: "",
  customer_name: "", customer_email: "", customer_company: "", customer_address: "", customer_gstin: "",
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
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);

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
        upi_id: profile.upi_id || "",
        bank_account_name: profile.bank_account_name || "",
        bank_account_number: profile.bank_account_number || "",
        bank_ifsc: profile.bank_ifsc || "",
        bank_name: profile.bank_name || "",
      }));
    });
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
    setForm(f => ({ ...f, customer_name: c.name, customer_email: c.email || "", customer_company: c.company || "", customer_address: c.address || "", customer_gstin: "" }));
  }

  function togglePaymentMethod(method: string) {
    setForm(f => ({
      ...f,
      payment_methods: f.payment_methods.includes(method)
        ? f.payment_methods.filter(m => m !== method)
        : [...f.payment_methods, method],
    }));
  }

  function addItem() { setItems([...items, { description: "", quantity: 1, rate: 0 }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    const u = [...items]; u[i] = { ...u[i], [field]: value }; setItems(u);
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const gstAmt = (subtotal * parseFloat(form.gst_rate || "0")) / 100;
  const total = subtotal + gstAmt;
  const halfGst = gstAmt / 2;

  const hasUPI = form.payment_methods.includes("UPI");
  const hasBank = form.payment_methods.includes("Bank Transfer");

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
    } finally { setSaving(false); }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    await fetch("/api/invoices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Invoice deleted");
    fetchInvoices();
  }

  async function markPaid(id: string) {
    await fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "paid" }) });
    toast.success("Marked as paid!");
    fetchInvoices();
  }

  function openEdit(inv: Invoice) {
    setEditTarget(inv);
    setEditItems(inv.items.map(i => ({ ...i })));
    setEditForm({
      invoice_date: inv.invoice_date || "",
      due_date: inv.due_date || "",
      gst_type: inv.gst_type || "cgst_sgst",
      gst_rate: String(inv.gst_rate ?? "18"),
      payment_methods: inv.payment_methods?.length ? inv.payment_methods : inv.payment_method ? [inv.payment_method] : [],
      transaction_id: inv.transaction_id || "",
      upi_id: inv.upi_id || "",
      bank_account_name: inv.bank_account_name || "",
      bank_account_number: inv.bank_account_number || "",
      bank_ifsc: inv.bank_ifsc || "",
      bank_name: inv.bank_name || "",
      notes: inv.notes || "",
      terms: inv.terms || "",
      seller_name: inv.seller_name || "",
      seller_address: inv.seller_address || "",
      seller_email: inv.seller_email || "",
      seller_phone: inv.seller_phone || "",
      seller_gstin: inv.seller_gstin || "",
      customer_name: inv.customer_name || "",
      customer_email: inv.customer_email || "",
      customer_company: inv.customer_company || "",
      customer_address: inv.customer_address || "",
      customer_gstin: inv.customer_gstin || "",
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const gst_rate = parseFloat(editForm.gst_rate);
      const subtotal = editItems.reduce((s, i) => s + i.quantity * i.rate, 0);
      const totalGst = (subtotal * gst_rate) / 100;
      const cgst = editForm.gst_type === "cgst_sgst" ? totalGst / 2 : 0;
      const sgst = editForm.gst_type === "cgst_sgst" ? totalGst / 2 : 0;
      const igst = editForm.gst_type === "igst" ? totalGst : 0;
      const total = subtotal + totalGst;

      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          ...editForm,
          gst_rate,
          items: editItems,
          subtotal, tax: totalGst, cgst, sgst, igst, total,
          payment_method: editForm.payment_methods.join(", ") || null,
          due_date: editForm.due_date || null,
          upi_id: editForm.upi_id || null,
          bank_account_name: editForm.bank_account_name || null,
          bank_account_number: editForm.bank_account_number || null,
          bank_ifsc: editForm.bank_ifsc || null,
          bank_name: editForm.bank_name || null,
          transaction_id: editForm.transaction_id || null,
          notes: editForm.notes || null,
          terms: editForm.terms || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Invoice updated!");
      setEditTarget(null);
      fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally { setEditSaving(false); }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sendTarget) return;
    setSending(true);
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: sendTarget.id, toEmail: sendEmail, toName: sendName, message: sendMessage }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Invoice sent to ${sendEmail}!`);
      setSendTarget(null); setSendEmail(""); setSendName(""); setSendMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally { setSending(false); }
  }

  const selectStyle = "h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none";
  const sectionStyle = "border dark:border-gray-700 rounded-lg p-4 space-y-3";
  const sectionTitle = "font-semibold text-sm text-gray-700 dark:text-gray-300";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create GST-compliant invoices</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(f => ({ ...emptyForm, seller_name: f.seller_name, seller_address: f.seller_address, seller_email: f.seller_email, seller_phone: f.seller_phone, seller_gstin: f.seller_gstin })); }}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Plus size={16} /> New Invoice
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
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
              <div className={sectionStyle}>
                <p className={sectionTitle}>Seller Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Business Name</Label><Input placeholder="Markwings" value={form.seller_name} onChange={e => setForm({ ...form, seller_name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Address</Label><Input placeholder="Mumbai, India" value={form.seller_address} onChange={e => setForm({ ...form, seller_address: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="hello@markwings.com" value={form.seller_email} onChange={e => setForm({ ...form, seller_email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="+91 98765 43210" value={form.seller_phone} onChange={e => setForm({ ...form, seller_phone: e.target.value })} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>GSTIN (optional)</Label><Input placeholder="22AAAAA0000A1Z5" value={form.seller_gstin} onChange={e => setForm({ ...form, seller_gstin: e.target.value })} /></div>
                </div>
              </div>

              {/* Customer */}
              <div className={sectionStyle}>
                <p className={sectionTitle}>Customer Details</p>
                {clients.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Select from saved clients</Label>
                    <select className={selectStyle} defaultValue="" onChange={e => selectClient(e.target.value)}>
                      <option value="">— Pick a client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Customer Name *</Label><Input placeholder="Rahul Sharma" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required /></div>
                  <div className="space-y-1.5"><Label>Customer Email</Label><Input type="email" placeholder="rahul@company.com" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Company Name</Label><Input placeholder="ABC Pvt Ltd" value={form.customer_company} onChange={e => setForm({ ...form, customer_company: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Customer GSTIN (B2B)</Label><Input placeholder="27AAAAA0000A1Z5" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value })} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>Billing Address</Label><Input placeholder="Delhi, India" value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} /></div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <p className={sectionTitle}>Line Items</p>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5"><Input placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} required /></div>
                    <div className="col-span-2"><Input type="number" placeholder="Qty" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} /></div>
                    <div className="col-span-3"><Input type="number" placeholder="Rate ₹" min={0} value={item.rate} onChange={e => updateItem(i, "rate", parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-1 text-right text-xs text-gray-500 dark:text-gray-400">₹{(item.quantity * item.rate).toLocaleString("en-IN")}</div>
                    <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></div>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-violet-600 text-sm hover:underline"><Plus size={14} /> Add Item</button>
              </div>

              {/* Tax */}
              <div className={sectionStyle}>
                <p className={sectionTitle}>Tax Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>GST Type</Label>
                    <select value={form.gst_type} onChange={e => setForm({ ...form, gst_type: e.target.value })} className={selectStyle}>
                      <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
                      <option value="igst">IGST (Inter-state)</option>
                      <option value="none">No GST</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>GST Rate (%)</Label>
                    <select value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: e.target.value })} className={selectStyle}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
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
              <div className={sectionStyle}>
                <p className={sectionTitle}>Payment Information</p>

                {/* Multi-select payment methods */}
                <div className="space-y-1.5">
                  <Label>Payment Method(s)</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_OPTIONS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => togglePaymentMethod(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          form.payment_methods.includes(m)
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-violet-400"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI ID */}
                {hasUPI && (
                  <div className="space-y-1.5">
                    <Label>UPI ID</Label>
                    <Input placeholder="yourname@upi" value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} />
                  </div>
                )}

                {/* Bank Details */}
                {hasBank && (
                  <div className="space-y-3 border-t dark:border-gray-700 pt-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Bank Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Account Name</Label><Input placeholder="Rahul Sharma / Markwings" value={form.bank_account_name} onChange={e => setForm({ ...form, bank_account_name: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Account Number</Label><Input placeholder="1234567890" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>IFSC Code</Label><Input placeholder="SBIN0001234" value={form.bank_ifsc} onChange={e => setForm({ ...form, bank_ifsc: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Bank Name</Label><Input placeholder="State Bank of India" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Transaction ID (if already paid)</Label>
                  <Input placeholder="TXN123456" value={form.transaction_id} onChange={e => setForm({ ...form, transaction_id: e.target.value })} />
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Notes / Remarks</Label><Textarea placeholder="Thank you for your business!" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                <div className="space-y-1.5"><Label>Terms & Conditions</Label><Textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} /></div>
              </div>

              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
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
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{inv.total.toLocaleString("en-IN")}</span>
                  <Badge className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                  <button onClick={() => openEdit(inv)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Edit invoice"><Pencil size={15} /></button>
                  <button onClick={() => { setSendTarget(inv); setSendEmail(inv.customer_email || ""); setSendName(inv.customer_name || ""); setSendMessage(""); }} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Send invoice by email"><Send size={16} /></button>
                  <button onClick={() => downloadInvoicePdf(inv, pdfColor)} className="text-gray-400 hover:text-violet-600" title="Download PDF"><Download size={16} /></button>
                  {inv.status === "unpaid" && <button onClick={() => markPaid(inv.id)} className="text-gray-400 hover:text-green-600" title="Mark as paid"><CheckCircle size={16} /></button>}
                  <button onClick={() => deleteInvoice(inv.id)} className="text-gray-400 hover:text-red-600" title="Delete invoice"><Trash2 size={16} /></button>
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
            <DialogHeader><DialogTitle>{selected.invoice_number}</DialogTitle></DialogHeader>
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

              <div className="space-y-1">
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{selected.subtotal.toLocaleString("en-IN")}</span></div>
                {selected.gst_type === "cgst_sgst" ? <>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({selected.gst_rate/2}%)</span><span>₹{(selected.cgst||0).toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({selected.gst_rate/2}%)</span><span>₹{(selected.sgst||0).toLocaleString("en-IN")}</span></div>
                </> : selected.gst_type === "igst" ? (
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({selected.gst_rate}%)</span><span>₹{(selected.igst||0).toLocaleString("en-IN")}</span></div>
                ) : null}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1"><span>Grand Total</span><span>₹{selected.total.toLocaleString("en-IN")}</span></div>
              </div>

              {/* Payment details */}
              {(() => {
                const methods = selected.payment_methods?.length ? selected.payment_methods : selected.payment_method ? [selected.payment_method] : [];
                const hasUpiView = methods.includes("UPI");
                const hasBankView = methods.includes("Bank Transfer");
                if (!methods.length && !selected.transaction_id) return null;
                return (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-1.5">
                    <p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase">Payment Details</p>
                    {methods.length > 0 && <p className="dark:text-gray-300">Method: {methods.join(", ")}</p>}
                    {hasUpiView && selected.upi_id && <p className="dark:text-gray-300">UPI ID: <span className="font-medium">{selected.upi_id}</span></p>}
                    {hasBankView && selected.bank_account_number && (<>
                      <p className="dark:text-gray-300">Account: <span className="font-medium">{selected.bank_account_name}</span></p>
                      <p className="dark:text-gray-300">Account No: <span className="font-medium">{selected.bank_account_number}</span></p>
                      <p className="dark:text-gray-300">IFSC: <span className="font-medium">{selected.bank_ifsc}</span> | Bank: <span className="font-medium">{selected.bank_name}</span></p>
                    </>)}
                    {selected.transaction_id && <p className="dark:text-gray-300">Txn ID: {selected.transaction_id}</p>}
                    <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
                  </div>
                );
              })()}

              {selected.notes && <div><p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Notes</p><p className="text-gray-500 dark:text-gray-400">{selected.notes}</p></div>}
              {selected.terms && <div><p className="font-semibold text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Terms</p><p className="text-gray-500 dark:text-gray-400">{selected.terms}</p></div>}
            </div>

            <div className="mt-4 border-t dark:border-gray-700 pt-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">PDF Accent Color</p>
              <div className="flex items-center gap-2 flex-wrap">
                {["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#db2777","#000000"].map(c => (
                  <button key={c} onClick={() => setPdfColor(c)} className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: pdfColor === c ? "#000" : "transparent" }} />
                ))}
                <label className="relative w-7 h-7 rounded-full border-2 border-gray-300 overflow-hidden cursor-pointer">
                  <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" value={pdfColor ?? "#ffffff"} onChange={e => setPdfColor(e.target.value)} />
                  <span className="flex items-center justify-center w-full h-full text-xs text-gray-400">+</span>
                </label>
                <button onClick={() => setPdfColor(null)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs text-gray-400 transition-all ${pdfColor === null ? "border-black" : "border-gray-300"}`} style={{ background: "repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 6px)" }} />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button onClick={() => downloadInvoicePdf(selected, pdfColor)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-2">
                <Download size={16} /> Download PDF
              </Button>
              <Button variant="outline" onClick={() => { setSendTarget(selected); setSendEmail(selected.customer_email || ""); setSendName(selected.customer_name || ""); setSelected(null); }} className="flex-1 gap-2 dark:border-gray-600 dark:text-gray-300">
                <Send size={16} /> Send Email
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Invoice Dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Invoice — {editTarget?.invoice_number}</DialogTitle></DialogHeader>
          {editTarget && (() => {
            const ef = editForm;
            const setEf = (patch: Partial<typeof emptyForm>) => setEditForm(f => ({ ...f, ...patch }));
            const editHasUPI = ef.payment_methods.includes("UPI");
            const editHasBank = ef.payment_methods.includes("Bank Transfer");
            const editSubtotal = editItems.reduce((s, i) => s + i.quantity * i.rate, 0);
            const editGstAmt = (editSubtotal * parseFloat(ef.gst_rate || "0")) / 100;
            const editTotal = editSubtotal + editGstAmt;
            const editHalfGst = editGstAmt / 2;
            return (
              <form onSubmit={handleUpdate} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Invoice Date</Label><Input type="date" value={ef.invoice_date} onChange={e => setEf({ invoice_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={ef.due_date} onChange={e => setEf({ due_date: e.target.value })} /></div>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Seller Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Business Name</Label><Input value={ef.seller_name} onChange={e => setEf({ seller_name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Address</Label><Input value={ef.seller_address} onChange={e => setEf({ seller_address: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={ef.seller_email} onChange={e => setEf({ seller_email: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Phone</Label><Input value={ef.seller_phone} onChange={e => setEf({ seller_phone: e.target.value })} /></div>
                    <div className="space-y-1.5 col-span-2"><Label>GSTIN</Label><Input value={ef.seller_gstin} onChange={e => setEf({ seller_gstin: e.target.value })} /></div>
                  </div>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Customer Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Customer Name</Label><Input value={ef.customer_name} onChange={e => setEf({ customer_name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Customer Email</Label><Input type="email" value={ef.customer_email} onChange={e => setEf({ customer_email: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Company</Label><Input value={ef.customer_company} onChange={e => setEf({ customer_company: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>GSTIN</Label><Input value={ef.customer_gstin} onChange={e => setEf({ customer_gstin: e.target.value })} /></div>
                    <div className="space-y-1.5 col-span-2"><Label>Billing Address</Label><Input value={ef.customer_address} onChange={e => setEf({ customer_address: e.target.value })} /></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={sectionTitle}>Line Items</p>
                  {editItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5"><Input value={item.description} onChange={e => { const u=[...editItems]; u[i]={...u[i],description:e.target.value}; setEditItems(u); }} /></div>
                      <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => { const u=[...editItems]; u[i]={...u[i],quantity:parseInt(e.target.value)||1}; setEditItems(u); }} /></div>
                      <div className="col-span-3"><Input type="number" min={0} value={item.rate} onChange={e => { const u=[...editItems]; u[i]={...u[i],rate:parseFloat(e.target.value)||0}; setEditItems(u); }} /></div>
                      <div className="col-span-1 text-right text-xs text-gray-500 dark:text-gray-400">₹{(item.quantity*item.rate).toLocaleString("en-IN")}</div>
                      <div className="col-span-1 flex justify-end"><button type="button" onClick={() => setEditItems(editItems.filter((_,idx)=>idx!==i))} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditItems([...editItems,{description:"",quantity:1,rate:0}])} className="flex items-center gap-1 text-violet-600 text-sm hover:underline"><Plus size={14}/>Add Item</button>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Tax Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>GST Type</Label>
                      <select value={ef.gst_type} onChange={e => setEf({ gst_type: e.target.value })} className={selectStyle}>
                        <option value="cgst_sgst">CGST + SGST</option>
                        <option value="igst">IGST</option>
                        <option value="none">No GST</option>
                      </select>
                    </div>
                    <div className="space-y-1.5"><Label>GST Rate (%)</Label>
                      <select value={ef.gst_rate} onChange={e => setEf({ gst_rate: e.target.value })} className={selectStyle}>
                        <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                      </select>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1.5">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{editSubtotal.toLocaleString("en-IN")}</span></div>
                    {ef.gst_type === "cgst_sgst" && <><div className="flex justify-between text-gray-500 dark:text-gray-400"><span>CGST ({parseFloat(ef.gst_rate)/2}%)</span><span>₹{editHalfGst.toLocaleString("en-IN")}</span></div><div className="flex justify-between text-gray-500 dark:text-gray-400"><span>SGST ({parseFloat(ef.gst_rate)/2}%)</span><span>₹{editHalfGst.toLocaleString("en-IN")}</span></div></>}
                    {ef.gst_type === "igst" && <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IGST ({ef.gst_rate}%)</span><span>₹{editGstAmt.toLocaleString("en-IN")}</span></div>}
                    <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t dark:border-gray-700 pt-1.5"><span>Grand Total</span><span>₹{editTotal.toLocaleString("en-IN")}</span></div>
                  </div>
                </div>

                <div className={sectionStyle}>
                  <p className={sectionTitle}>Payment Information</p>
                  <div className="space-y-1.5">
                    <Label>Payment Method(s)</Label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_OPTIONS.map(m => (
                        <button key={m} type="button"
                          onClick={() => setEf({ payment_methods: ef.payment_methods.includes(m) ? ef.payment_methods.filter(x=>x!==m) : [...ef.payment_methods,m] })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ef.payment_methods.includes(m) ? "bg-violet-600 text-white border-violet-600" : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"}`}
                        >{m}</button>
                      ))}
                    </div>
                  </div>
                  {editHasUPI && <div className="space-y-1.5"><Label>UPI ID</Label><Input value={ef.upi_id} onChange={e => setEf({ upi_id: e.target.value })} placeholder="yourname@upi" /></div>}
                  {editHasBank && (
                    <div className="space-y-3 border-t dark:border-gray-700 pt-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Bank Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label>Account Name</Label><Input value={ef.bank_account_name} onChange={e => setEf({ bank_account_name: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Account Number</Label><Input value={ef.bank_account_number} onChange={e => setEf({ bank_account_number: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>IFSC Code</Label><Input value={ef.bank_ifsc} onChange={e => setEf({ bank_ifsc: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Bank Name</Label><Input value={ef.bank_name} onChange={e => setEf({ bank_name: e.target.value })} /></div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5"><Label>Transaction ID</Label><Input value={ef.transaction_id} onChange={e => setEf({ transaction_id: e.target.value })} placeholder="TXN123456" /></div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Notes</Label><Textarea value={ef.notes} onChange={e => setEf({ notes: e.target.value })} rows={2} /></div>
                  <div className="space-y-1.5"><Label>Terms & Conditions</Label><Textarea value={ef.terms} onChange={e => setEf({ terms: e.target.value })} rows={2} /></div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={editSaving}>{editSaving ? "Saving..." : "Save Changes"}</Button>
                  <Button type="button" variant="outline" className="dark:border-gray-600 dark:text-gray-300" onClick={() => setEditTarget(null)}>Cancel</Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Send Invoice Email Dialog */}
      <Dialog open={!!sendTarget} onOpenChange={v => { if (!v) setSendTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Invoice by Email</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            Sending <span className="font-medium text-gray-700 dark:text-gray-300">{sendTarget?.invoice_number}</span> via your Gmail SMTP.
          </p>
          <form onSubmit={handleSend} className="space-y-4 mt-1">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input placeholder="Rahul Sharma" value={sendName} onChange={e => setSendName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recipient Email *</Label>
              <Input type="email" placeholder="rahul@company.com" value={sendEmail} onChange={e => setSendEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea placeholder="Please find your invoice attached. Thank you for your business!" value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={3} />
            </div>
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2" disabled={sending}>
              <Send size={14} /> {sending ? "Sending..." : "Send Invoice"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
