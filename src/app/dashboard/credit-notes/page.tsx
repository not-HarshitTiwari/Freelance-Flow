"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Undo2, CalendarDays, Download, Plus, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";

type CreditNote = {
  id: string;
  credit_note_number: string;
  amount: number;
  reason: string | null;
  created_at: string;
  invoices: { invoice_number: string; customer_name: string | null; customer_email: string | null; total: number } | null;
};

type InvoiceOption = { id: string; invoice_number: string; customer_name: string | null; total: number; amount_paid: number | null; status: string };

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ invoiceId: "", amount: "", reason: "" });

  const fetchCreditNotes = useCallback(async () => {
    const res = await fetch("/api/credit-notes");
    const data = await res.json();
    if (data.error) toast.error(data.error);
    setCreditNotes(data.creditNotes || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCreditNotes(); }, [fetchCreditNotes]);

  async function openCreate() {
    if (!invoices.length) {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoices((data.invoices || []).filter((i: InvoiceOption) => ["unpaid", "partial", "overdue"].includes(i.status)));
    }
    setForm({ invoiceId: "", amount: "", reason: "" });
    setOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this credit note? The invoice balance will be restored.")) return;
    const res = await fetch("/api/credit-notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success("Credit note deleted"); fetchCreditNotes(); }
    else { const d = await res.json(); toast.error(d.error); }
  }

  async function downloadPdf(c: CreditNote) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFillColor(124, 58, 237); doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("CREDIT NOTE", 14, 18);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`#${c.credit_note_number}`, 14, 24);
    doc.text(`Date: ${new Date(c.created_at).toLocaleDateString("en-IN")}`, 140, 18);
    doc.setTextColor(30, 30, 30); doc.setFontSize(11);
    let y = 45;
    if (c.invoices?.invoice_number) { doc.text(`Against Invoice: ${c.invoices.invoice_number}`, 14, y); y += 8; }
    if (c.invoices?.customer_name) { doc.text(`Customer: ${c.invoices.customer_name}`, 14, y); y += 8; }
    if (c.reason) { doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text(`Reason: ${c.reason}`, 14, y); y += 8; }
    y += 4;
    doc.setFillColor(245, 243, 255); doc.rect(14, y, 182, 16, "F");
    doc.setTextColor(124, 58, 237); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Credit Amount:", 16, y + 10);
    doc.text(`₹${c.amount.toLocaleString("en-IN")}`, 160, y + 10);
    doc.save(`${c.credit_note_number}.pdf`);
  }

  async function handleCreate() {
    if (!form.invoiceId || !form.amount) { toast.error("Select invoice and enter amount"); return; }
    setSaving(true);
    const res = await fetch("/api/credit-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: form.invoiceId, amount: parseFloat(form.amount), reason: form.reason }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error); return; }
    toast.success("Credit note created");
    setOpen(false);
    fetchCreditNotes();
  }

  const selectedInvoice = invoices.find(i => i.id === form.invoiceId);
  const maxAmount = selectedInvoice ? selectedInvoice.total - (selectedInvoice.amount_paid ?? 0) : 0;

  const filtered = creditNotes.filter(c => {
    const q = searchQ.toLowerCase();
    if (!q) return true;
    return (
      c.credit_note_number.toLowerCase().includes(q) ||
      (c.invoices?.invoice_number || "").toLowerCase().includes(q) ||
      (c.invoices?.customer_name || "").toLowerCase().includes(q) ||
      (c.reason || "").toLowerCase().includes(q)
    );
  });

  const totalCredited = creditNotes.reduce((s, c) => s + c.amount, 0);

  function exportCSV() {
    const rows = [["Credit Note #", "Date", "Invoice #", "Customer", "Amount (₹)", "Reason"]];
    for (const c of creditNotes) {
      rows.push([
        c.credit_note_number,
        new Date(c.created_at).toLocaleDateString("en-IN"),
        c.invoices?.invoice_number || "",
        c.invoices?.customer_name || "",
        String(c.amount),
        c.reason || "",
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "credit-notes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Credit Notes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Reduce an outstanding invoice balance</p>
        </div>
        <div className="flex gap-2">
          {creditNotes.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 dark:hover:text-violet-400">
              <Download size={15} /> Export CSV
            </button>
          )}
          <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus size={15} /> New Credit Note
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Undo2 size={18} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Credited</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalCredited)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <CalendarDays size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Credit Notes Issued</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{creditNotes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {creditNotes.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search…" value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-16">Loading…</p>
      ) : creditNotes.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Undo2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No credit notes yet</p>
          <p className="text-sm mb-4">Click &quot;New Credit Note&quot; to issue one against an invoice.</p>
          <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus size={15} /> New Credit Note
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium dark:text-gray-400">No results</p>
          <button onClick={() => setSearchQ("")} className="text-sm text-violet-500 underline mt-1">Clear search</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {c.credit_note_number}
                    {c.invoices?.invoice_number && ` — against ${c.invoices.invoice_number}`}
                    {c.invoices?.customer_name && ` (${c.invoices.customer_name})`}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(c.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    {c.reason && ` • ${c.reason}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">-{fmt(c.amount)}</p>
                  <button onClick={() => downloadPdf(c)} className="text-gray-400 hover:text-violet-600 p-1" title="Download PDF"><FileDown size={15} /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete"><Trash2 size={15} /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-white">New Credit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Invoice</Label>
              <select
                value={form.invoiceId}
                onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value, amount: "" }))}
                className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-800 dark:text-gray-100 px-2.5 text-sm outline-none"
              >
                <option value="">Select an invoice…</option>
                {invoices.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number} — {i.customer_name || "Unknown"} (balance: {fmt(i.total - (i.amount_paid ?? 0))})
                  </option>
                ))}
              </select>
              {!invoices.length && <p className="text-xs text-gray-400">No unpaid invoices found.</p>}
            </div>

            <div className="space-y-1">
              <Label>Amount {selectedInvoice && <span className="text-gray-400 font-normal">(max {fmt(maxAmount)})</span>}</Label>
              <Input
                type="number"
                min={0.01}
                max={maxAmount || undefined}
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Reason <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea
                rows={2}
                placeholder="e.g. Overbilled, returned goods, discount adjustment"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} disabled={saving || !form.invoiceId || !form.amount} className="bg-violet-600 hover:bg-violet-700 text-white">
                {saving ? "Issuing…" : "Issue Credit Note"}
              </Button>
              <Button variant="outline" className="dark:border-gray-600 dark:text-gray-300" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
