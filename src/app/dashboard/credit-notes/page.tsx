"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Undo2, CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";

type CreditNote = {
  id: string;
  credit_note_number: string;
  amount: number;
  reason: string | null;
  created_at: string;
  invoices: { invoice_number: string; customer_name: string | null; customer_email: string | null; total: number } | null;
};

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  const fetchCreditNotes = useCallback(async () => {
    const res = await fetch("/api/credit-notes");
    const data = await res.json();
    if (data.error) toast.error(data.error);
    setCreditNotes(data.creditNotes || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCreditNotes(); }, [fetchCreditNotes]);

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

  const totalCredited = filtered.reduce((s, c) => s + c.amount, 0);

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
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Issued from the invoice list to reduce an outstanding balance</p>
        </div>
        {creditNotes.length > 0 && (
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 dark:hover:text-violet-400">
            <Download size={15} /> Export CSV
          </button>
        )}
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
          <Input placeholder="Search by number, invoice, client, or reason…" value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-16">Loading…</p>
      ) : creditNotes.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Undo2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No credit notes issued yet</p>
          <p className="text-sm">Issue one from an invoice&apos;s row actions and it&apos;ll show up here</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium dark:text-gray-400">No credit notes match your search</p>
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
                <p className="text-lg font-semibold text-orange-600 dark:text-orange-400 shrink-0">-{fmt(c.amount)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
