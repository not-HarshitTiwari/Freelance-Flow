"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileSpreadsheet, Trash2, Pencil, Link2, ArrowRightCircle, Search, Download, MessageCircle, Mail } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import { downloadQuotePdf } from "@/lib/quote-pdf";

type QuoteItem = { description: string; quantity: number; rate: number; product_id?: string; discount_pct?: number };

type Product = {
  id: string;
  name: string;
  unit_price: number;
  hsn_code: string | null;
  type: "product" | "service";
  track_inventory: boolean;
  quantity: number | null;
};

type Quote = {
  id: string;
  quote_number: string;
  items: QuoteItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst_type: string;
  gst_rate: number;
  total: number;
  status: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_gstin: string | null;
  customer_name: string | null;
  customer_company: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_gstin: string | null;
  client_id: string | null;
  converted_invoice_id: string | null;
  vat_rate: number | null;
  vat_amount: number | null;
  created_at: string;
};

type Profile = {
  full_name: string | null;
  business_name: string | null;
  business_address: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
};

type Client = { id: string; name: string; email: string; phone: string | null; company: string | null; address: string | null };

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  accepted: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  expired: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  converted: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
};

const emptyItem: QuoteItem = { description: "", quantity: 1, rate: 0 };

function getStockWarning(item: QuoteItem, products: Product[]): string | null {
  if (!item.product_id) return null;
  const p = products.find(pr => pr.id === item.product_id);
  if (!p || !p.track_inventory) return null;
  const available = p.quantity ?? 0;
  if (item.quantity > available) return available <= 0 ? "Out of stock" : `Only ${available} in stock`;
  return null;
}

function ProductPicker({ value, products, onChangeText, onSelect }: {
  value: string;
  products: Product[];
  onChangeText: (text: string) => void;
  onSelect: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtered = (value.trim()
    ? products.filter(p => p.name.toLowerCase().includes(value.toLowerCase()))
    : products
  ).slice(0, 6);

  return (
    <div className="relative flex-1">
      <Input
        placeholder="Description"
        value={value}
        onChange={e => { onChangeText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(p); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2"
            >
              <span className="truncate text-gray-900 dark:text-gray-100">{p.name}</span>
              <span className="text-xs text-gray-400 shrink-0">₹{p.unit_price.toLocaleString("en-IN")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRows({ rows, products, onChange, onSelectProduct, onAdd, onRemove }: {
  rows: QuoteItem[];
  products: Product[];
  onChange: (i: number, field: keyof QuoteItem, value: string | number) => void;
  onSelectProduct: (i: number, p: Product) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Items</Label>
      {rows.map((item, i) => {
        const stockWarning = getStockWarning(item, products);
        return (
          <div key={i}>
            <div className="flex gap-2 items-start">
              <ProductPicker
                value={item.description}
                products={products}
                onChangeText={v => onChange(i, "description", v)}
                onSelect={p => onSelectProduct(i, p)}
              />
              <Input
                type="number"
                placeholder="Qty"
                value={item.quantity}
                onChange={e => onChange(i, "quantity", Number(e.target.value))}
                className="w-16"
              />
              <Input
                type="number"
                placeholder="Rate"
                value={item.rate}
                onChange={e => onChange(i, "rate", Number(e.target.value))}
                className="w-24"
              />
              <Input
                type="number"
                placeholder="Disc%"
                min={0}
                max={100}
                value={item.discount_pct || ""}
                onChange={e => onChange(i, "discount_pct", Number(e.target.value))}
                className="w-16"
              />
              {rows.length > 1 && (
                <button type="button" onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500 mt-2">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {stockWarning && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{stockWarning}</p>}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="gap-1">
        <Plus size={14} /> Add Item
      </Button>
    </div>
  );
}

export default function QuotesPage() {
  const { ownerId } = useWorkspace();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [converting, setConverting] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([{ ...emptyItem }]);
  const [gstType, setGstType] = useState("cgst_sgst");
  const [gstRate, setGstRate] = useState(18);
  const [taxMode, setTaxMode] = useState<"gst" | "vat">("gst");
  const [vatRate, setVatRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [sellerInfo, setSellerInfo] = useState({ seller_name: "", seller_address: "", seller_email: "", seller_phone: "", seller_gstin: "" });
  const [editQuoteNumber, setEditQuoteNumber] = useState("");

  const fetchQuotes = useCallback(async () => {
    const res = await fetch("/api/quotes");
    const data = await res.json();
    setQuotes(data.quotes || []);
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    fetchQuotes();
    const supabase = createClient();
    supabase.from("clients").select("id, name, email, phone, company, address").eq("user_id", ownerId).order("name").then(({ data: clientData }) => {
      setClients(clientData || []);
    });
    fetch("/api/products").then(r => r.json()).then(({ products }) => setProducts(products || []));
    fetch("/api/profile").then(r => r.json()).then(({ profile }: { profile: Profile | null }) => {
      if (profile) {
        setSellerInfo({
          seller_name: profile.business_name || profile.full_name || "",
          seller_address: profile.business_address || "",
          seller_email: profile.email || "",
          seller_phone: profile.phone || "",
          seller_gstin: profile.gstin || "",
        });
      }
    });
  }, [fetchQuotes, ownerId]);

  function resetForm() {
    setSelectedClientId("");
    setItems([{ ...emptyItem }]);
    setGstType("cgst_sgst");
    setGstRate(18);
    setTaxMode("gst");
    setVatRate(0);
    setValidUntil("");
    setNotes("");
    setTerms("");
    setCustomerName("");
    setCustomerCompany("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerGstin("");
  }

  function pickClient(id: string) {
    setSelectedClientId(id);
    if (!id) return;
    const c = clients.find(cl => cl.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerEmail(c.email);
      setCustomerPhone(c.phone || "");
      setCustomerCompany(c.company || "");
      setCustomerAddress(c.address || "");
    }
  }

  function updateItem(i: number, field: keyof QuoteItem, value: string | number) {
    setItems(its => its.map((it, idx) =>
      idx === i ? { ...it, [field]: value, ...(field === "description" ? { product_id: undefined } : {}) } : it
    ));
  }

  function pickProduct(i: number, p: Product) {
    setItems(its => its.map((it, idx) =>
      idx === i ? { ...it, description: p.name, rate: p.unit_price, product_id: p.id } : it
    ));
  }

  function addItem() { setItems(its => [...its, { ...emptyItem }]); }
  function removeItem(i: number) { setItems(its => its.filter((_, idx) => idx !== i)); }

  const qGrossSubtotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.rate || 0), 0);
  const qDiscountTotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.rate || 0) * ((it.discount_pct || 0) / 100), 0);
  const subtotal = qGrossSubtotal - qDiscountTotal;
  const gstAmount = taxMode === "gst" ? (subtotal * gstRate) / 100 : 0;
  const vatAmount = taxMode === "vat" ? (subtotal * vatRate) / 100 : 0;
  const total = subtotal + gstAmount + vatAmount;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId || null,
          items,
          gst_type: taxMode === "vat" ? "vat" : gstType,
          gst_rate: taxMode === "vat" ? vatRate : gstRate,
          vat_rate: taxMode === "vat" ? vatRate : 0,
          valid_until: validUntil || null, notes, terms,
          ...sellerInfo,
          customer_name: customerName, customer_company: customerCompany,
          customer_email: customerEmail, customer_phone: customerPhone, customer_address: customerAddress, customer_gstin: customerGstin,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Quote created!");
      setOpen(false);
      resetForm();
      fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(q: Quote) {
    setEditing(q);
    setEditQuoteNumber(q.quote_number);
    setItems(q.items?.length ? q.items : [{ ...emptyItem }]);
    const isVat = q.gst_type === "vat" || (q.vat_rate && q.vat_rate > 0);
    setGstType(isVat ? "cgst_sgst" : q.gst_type);
    setGstRate(isVat ? 18 : q.gst_rate);
    setTaxMode(isVat ? "vat" : "gst");
    setVatRate(q.vat_rate || 0);
    setValidUntil(q.valid_until || "");
    setNotes(q.notes || "");
    setTerms(q.terms || "");
    setCustomerName(q.customer_name || "");
    setCustomerCompany(q.customer_company || "");
    setCustomerEmail(q.customer_email || "");
    setCustomerPhone(q.customer_phone || "");
    setCustomerAddress(q.customer_address || "");
    setCustomerGstin(q.customer_gstin || "");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editQuoteNumber.trim()) { toast.error("Quote number can't be empty"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id, quote_number: editQuoteNumber.trim(), items,
          gst_type: taxMode === "vat" ? "vat" : gstType,
          gst_rate: taxMode === "vat" ? vatRate : gstRate,
          vat_rate: taxMode === "vat" ? vatRate : 0,
          valid_until: validUntil || null, notes, terms,
          customer_name: customerName, customer_company: customerCompany,
          customer_email: customerEmail, customer_phone: customerPhone, customer_address: customerAddress, customer_gstin: customerGstin,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Quote updated!");
      setEditing(null);
      fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update quote");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuote(id: string) {
    if (!confirm("Delete this quote? This cannot be undone.")) return;
    await fetch("/api/quotes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Quote deleted");
    fetchQuotes();
  }

  async function copyReviewLink(id: string) {
    const res = await fetch("/api/quotes/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: id }) });
    const data = await res.json();
    if (data.token) {
      await navigator.clipboard.writeText(`${window.location.origin}/quote/${data.token}`);
      toast.success("Quote review link copied!");
      fetchQuotes();
    } else {
      toast.error("Failed to generate link");
    }
  }

  async function sendQuoteEmail(id: string) {
    try {
      const res = await fetch("/api/quotes/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      toast.success("Quote emailed to client!");
      fetchQuotes();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send email"); }
  }

  async function sendQuoteWhatsApp(id: string) {
    try {
      const res = await fetch("/api/quotes/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: id }) });
      const data = await res.json();
      if (data.fallback) {
        window.open(data.link, "_blank");
      } else if (data.success) {
        toast.success("Sent over WhatsApp!");
      } else {
        throw new Error(data.error || "Failed to send WhatsApp message");
      }
      fetchQuotes();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send WhatsApp message"); }
  }

  async function convertToInvoice(id: string) {
    setConverting(id);
    try {
      const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Converted to invoice ${data.invoice.invoice_number}`);
      if (data.stock_warning) toast.warning(data.stock_warning);
      fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to convert quote");
    } finally {
      setConverting(null);
    }
  }

  const filtered = quotes.filter(q => {
    const q1 = searchQ.toLowerCase();
    return (!q1 || q.quote_number.toLowerCase().includes(q1) || (q.customer_name || "").toLowerCase().includes(q1))
      && (statusF === "all" || q.status === statusF);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quotes & Estimates</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Send quotes to clients and convert accepted ones into invoices</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Plus size={16} /> New Quote
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Quote</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Pick a saved client (optional)</Label>
                  <select
                    value={selectedClientId}
                    onChange={e => pickClient(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none"
                  >
                    <option value="">— Select client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Client Name *</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Client Email</Label><Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Client Phone (WhatsApp)</Label><Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Company</Label><Input value={customerCompany} onChange={e => setCustomerCompany(e.target.value)} /></div>

              <ItemRows rows={items} products={products} onChange={updateItem} onSelectProduct={pickProduct} onAdd={addItem} onRemove={removeItem} />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tax</Label>
                  <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden text-xs">
                    {(["gst", "vat"] as const).map(m => (
                      <button key={m} type="button" onClick={() => setTaxMode(m)}
                        className={`px-3 py-1 font-medium uppercase transition-colors ${taxMode === m ? "bg-violet-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {taxMode === "gst" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={gstType} onChange={e => setGstType(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                      <option value="cgst_sgst">CGST + SGST</option>
                      <option value="igst">IGST</option>
                      <option value="none">No GST</option>
                    </select>
                    <Input type="number" placeholder="Rate %" value={gstRate} onChange={e => setGstRate(Number(e.target.value))} />
                  </div>
                ) : (
                  <Input type="number" placeholder="VAT Rate %" min={0} max={100} value={vatRate} onChange={e => setVatRate(Number(e.target.value))} />
                )}
              </div>

              <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
              <div className="space-y-2"><Label>Terms</Label><Textarea rows={2} value={terms} onChange={e => setTerms(e.target.value)} /></div>

              <div className="flex justify-between text-sm border-t pt-3 dark:border-gray-700">
                {qDiscountTotal > 0 && <span className="text-red-500">Discount: -₹{qDiscountTotal.toLocaleString("en-IN")} ·&nbsp;</span>}
                <span className="text-gray-500">Subtotal: ₹{subtotal.toLocaleString("en-IN")} · Tax: ₹{(gstAmount + vatAmount).toLocaleString("en-IN")}</span>
                <span className="font-semibold text-gray-900 dark:text-white">Total: ₹{total.toLocaleString("en-IN")}</span>
              </div>

              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
                {saving ? "Creating..." : "Create Quote"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {quotes.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search quotes…" value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["all", "draft", "sent", "accepted", "rejected", "converted"].map(s => (
              <button key={s} onClick={() => setStatusF(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${statusF === s ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No quotes yet</p>
          <p className="text-sm">Click &quot;New Quote&quot; to create your first one</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium dark:text-gray-400">No quotes match your filter</p>
          <button onClick={() => { setSearchQ(""); setStatusF("all"); }} className="text-sm text-violet-500 underline mt-1">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <Card key={q.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{q.quote_number} — {q.customer_name}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(q.created_at).toLocaleDateString("en-IN")} • ₹{q.total.toLocaleString("en-IN")}
                    {q.valid_until && ` • Valid until ${new Date(q.valid_until).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[q.status] || ""}>{q.status}</Badge>
                  <button onClick={() => downloadQuotePdf(q)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Download quotation">
                    <Download size={15} />
                  </button>
                  <button onClick={() => openEdit(q)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Edit quote">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => copyReviewLink(q.id)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400" title="Copy client review link">
                    <Link2 size={15} />
                  </button>
                  <button onClick={() => sendQuoteEmail(q.id)} className="text-gray-400 hover:text-blue-500" title="Send by Email">
                    <Mail size={15} />
                  </button>
                  <button onClick={() => sendQuoteWhatsApp(q.id)} className="text-gray-400 hover:text-green-500" title="Send by WhatsApp">
                    <MessageCircle size={15} />
                  </button>
                  {q.status === "accepted" && !q.converted_invoice_id && (
                    <button
                      onClick={() => convertToInvoice(q.id)}
                      disabled={converting === q.id}
                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Convert to invoice"
                    >
                      <ArrowRightCircle size={15} />
                    </button>
                  )}
                  <button onClick={() => deleteQuote(q.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Delete quote">
                    <Trash2 size={15} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Quote Dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit — {editing?.quote_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Quote Number *</Label><Input value={editQuoteNumber} onChange={e => setEditQuoteNumber(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Client Name *</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Client Email</Label><Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Company</Label><Input value={customerCompany} onChange={e => setCustomerCompany(e.target.value)} /></div>

            <ItemRows rows={items} products={products} onChange={updateItem} onSelectProduct={pickProduct} onAdd={addItem} onRemove={removeItem} />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tax</Label>
                <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden text-xs">
                  {(["gst", "vat"] as const).map(m => (
                    <button key={m} type="button" onClick={() => setTaxMode(m)}
                      className={`px-3 py-1 font-medium uppercase transition-colors ${taxMode === m ? "bg-violet-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {taxMode === "gst" ? (
                <div className="grid grid-cols-2 gap-2">
                  <select value={gstType} onChange={e => setGstType(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                    <option value="cgst_sgst">CGST + SGST</option>
                    <option value="igst">IGST</option>
                    <option value="none">No GST</option>
                  </select>
                  <Input type="number" placeholder="Rate %" value={gstRate} onChange={e => setGstRate(Number(e.target.value))} />
                </div>
              ) : (
                <Input type="number" placeholder="VAT Rate %" min={0} max={100} value={vatRate} onChange={e => setVatRate(Number(e.target.value))} />
              )}
            </div>

            <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div className="space-y-2"><Label>Terms</Label><Textarea rows={2} value={terms} onChange={e => setTerms(e.target.value)} /></div>

            <div className="flex justify-between text-sm border-t pt-3 dark:border-gray-700">
              {qDiscountTotal > 0 && <span className="text-red-500">Discount: -₹{qDiscountTotal.toLocaleString("en-IN")} ·&nbsp;</span>}
              <span className="text-gray-500">Subtotal: ₹{subtotal.toLocaleString("en-IN")} · Tax: ₹{(gstAmount + vatAmount).toLocaleString("en-IN")}</span>
              <span className="font-semibold text-gray-900 dark:text-white">Total: ₹{total.toLocaleString("en-IN")}</span>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" className="dark:border-gray-600 dark:text-gray-300" onClick={() => setEditing(null)}>Cancel</Button>
              {editing && (
                <Button variant="outline" className="gap-1.5 dark:border-gray-600 dark:text-gray-300" onClick={() => downloadQuotePdf(editing)}>
                  <Download size={14} /> Download
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
