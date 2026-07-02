"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, IndianRupee, Receipt, CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Payment = {
  id: string;
  amount: number;
  note: string | null;
  method: string | null;
  paid_at: string;
  invoice_id: string;
  invoices: { invoice_number: string; customer_name: string | null; customer_company: string | null; total: number } | null;
};

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const fetchPayments = useCallback(async () => {
    const res = await fetch("/api/payments");
    const data = await res.json();
    setPayments(data.payments || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const filtered = payments.filter(p => {
    const q = searchQ.toLowerCase();
    const matchQ = !q || (p.invoices?.invoice_number || "").toLowerCase().includes(q) || (p.invoices?.customer_name || "").toLowerCase().includes(q) || (p.invoices?.customer_company || "").toLowerCase().includes(q) || (p.note || "").toLowerCase().includes(q);
    const matchMonth = !monthFilter || p.paid_at.startsWith(monthFilter);
    return matchQ && matchMonth;
  });

  const totalReceived = filtered.reduce((s, p) => s + p.amount, 0);
  const now = new Date();
  const thisMonthTotal = payments
    .filter(p => { const d = new Date(p.paid_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .reduce((s, p) => s + p.amount, 0);

  function exportCSV() {
    const rows = [["Date", "Invoice #", "Customer", "Method", "Note", "Amount (₹)"]];
    for (const p of filtered) {
      rows.push([
        new Date(p.paid_at).toLocaleDateString("en-IN"),
        p.invoices?.invoice_number || "",
        p.invoices?.customer_name || "",
        p.method || "",
        p.note || "",
        String(p.amount),
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "payments.csv" });
    a.click();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Every payment recorded against your invoices</p>
        </div>
        {payments.length > 0 && (
          <Button onClick={exportCSV} variant="outline" className="gap-2 dark:border-gray-600 dark:text-gray-300 h-8 text-sm px-3">
            <Download size={15} /> Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <IndianRupee size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Received</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalReceived)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <CalendarDays size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Received This Month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(thisMonthTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Receipt size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Payments Recorded</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {payments.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search by invoice, client, or note…" value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="h-9 text-sm w-40" title="Filter by month" />
          {monthFilter && <button onClick={() => setMonthFilter("")} className="text-xs text-violet-500 underline px-1">Clear</button>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-16">Loading…</p>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Receipt size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No payments recorded yet</p>
          <p className="text-sm">Record a payment from an invoice and it&apos;ll show up here</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium dark:text-gray-400">No payments match your filter</p>
          <button onClick={() => { setSearchQ(""); setMonthFilter(""); }} className="text-sm text-violet-500 underline mt-1">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {p.invoices?.invoice_number || "—"}
                    {p.invoices?.customer_name && ` — ${p.invoices.customer_name}`}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(p.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    {p.method && ` • ${p.method}`}
                    {p.note && ` • ${p.note}`}
                  </p>
                </div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400 shrink-0">{fmt(p.amount)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
