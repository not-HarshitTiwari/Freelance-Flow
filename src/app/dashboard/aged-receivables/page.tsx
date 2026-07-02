"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type InvRow = {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  customer_name: string | null;
  customer_company: string | null;
  total: number;
  amount_paid: number | null;
  status: string;
  invoice_type: string | null;
};

function ageBucket(dueDateStr: string | null): string {
  if (!dueDateStr) return "No Due Date";
  const days = Math.floor((Date.now() - new Date(dueDateStr).getTime()) / 86400000);
  if (days <= 0) return "Current";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}

const BUCKET_ORDER = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days", "No Due Date"];
const BUCKET_COLORS: Record<string, string> = {
  "Current": "bg-green-100 text-green-700",
  "1–30 days": "bg-yellow-100 text-yellow-700",
  "31–60 days": "bg-orange-100 text-orange-700",
  "61–90 days": "bg-red-100 text-red-700",
  "90+ days": "bg-red-200 text-red-800",
  "No Due Date": "bg-gray-100 text-gray-600",
};

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function AgedReceivablesPage() {
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBucket, setFilterBucket] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invoices")
      .then(r => r.json())
      .then(d => { setInvoices(d.invoices || []); setLoading(false); });
  }, []);

  const rows = useMemo(() => {
    return invoices
      .filter(inv =>
        inv.invoice_type !== "proforma" &&
        ["unpaid", "partial", "overdue"].includes(inv.status)
      )
      .map(inv => {
        const balance = inv.total - (inv.amount_paid ?? 0);
        const bucket = ageBucket(inv.due_date);
        return { ...inv, balance, bucket };
      })
      .filter(r => r.balance > 0)
      .sort((a, b) => {
        const ai = BUCKET_ORDER.indexOf(a.bucket);
        const bi = BUCKET_ORDER.indexOf(b.bucket);
        return ai !== bi ? ai - bi : b.balance - a.balance;
      });
  }, [invoices]);

  const filtered = filterBucket ? rows.filter(r => r.bucket === filterBucket) : rows;

  const bucketTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) map[r.bucket] = (map[r.bucket] || 0) + r.balance;
    return map;
  }, [rows]);

  const grandTotal = rows.reduce((s, r) => s + r.balance, 0);

  function exportCSV() {
    const header = ["Invoice #", "Client", "Invoice Date", "Due Date", "Age Bucket", "Total", "Paid", "Balance"];
    const body = filtered.map(r => [
      r.invoice_number,
      r.customer_name || "",
      r.invoice_date || "",
      r.due_date || "",
      r.bucket,
      r.total.toFixed(2),
      (r.amount_paid ?? 0).toFixed(2),
      r.balance.toFixed(2),
    ]);
    const csv = [header, ...body].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "aged-receivables.csv",
    });
    a.click();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aged Receivables</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Outstanding balances grouped by overdue period</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2 dark:border-gray-600 dark:text-gray-300">
          <Download size={15} /> Export CSV
        </Button>
      </div>

      {/* Bucket summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6 sm:grid-cols-6">
        {BUCKET_ORDER.filter(b => b !== "No Due Date" || bucketTotals["No Due Date"]).map(b => (
          <button
            key={b}
            onClick={() => setFilterBucket(filterBucket === b ? null : b)}
            className={`rounded-xl border p-3 text-left transition-all ${filterBucket === b ? "ring-2 ring-violet-500" : ""} ${bucketTotals[b] ? "cursor-pointer hover:shadow-sm" : "opacity-40 cursor-default"} bg-white dark:bg-gray-900 dark:border-gray-700`}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{b}</p>
            <p className="font-bold text-sm text-gray-900 dark:text-white">{fmt(bucketTotals[b] || 0)}</p>
          </button>
        ))}
      </div>

      {/* Grand total + filter hint */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {filterBucket && (
            <button onClick={() => setFilterBucket(null)} className="text-xs text-violet-600 dark:text-violet-400 underline">
              Clear filter
            </button>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} invoice{filtered.length !== 1 ? "s" : ""} · Total outstanding: <strong className="text-gray-900 dark:text-white">{fmt(grandTotal)}</strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium dark:text-gray-500">No outstanding receivables</p>
          <p className="text-sm mt-1">All invoices are paid or no overdue invoices found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-left">
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Due Date</th>
                <th className="px-4 py-3 font-semibold">Age</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Paid</th>
                <th className="px-4 py-3 font-semibold text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? "" : "bg-gray-50/40 dark:bg-gray-800/30"}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {r.customer_name || "—"}
                    {r.customer_company && <span className="block text-xs text-gray-400">{r.customer_company}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {r.due_date ? new Date(r.due_date).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${BUCKET_COLORS[r.bucket]}`}>{r.bucket}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{fmt(r.total)}</td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{fmt(r.amount_paid ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                <td colSpan={4} className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                  {fmt(filtered.reduce((s, r) => s + r.total, 0))}
                </td>
                <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                  {fmt(filtered.reduce((s, r) => s + (r.amount_paid ?? 0), 0))}
                </td>
                <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                  {fmt(filtered.reduce((s, r) => s + r.balance, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
