"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, IndianRupee, Receipt, CalendarDays } from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  note: string | null;
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

  const fetchPayments = useCallback(async () => {
    const res = await fetch("/api/payments");
    const data = await res.json();
    setPayments(data.payments || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const filtered = payments.filter(p => {
    const q = searchQ.toLowerCase();
    if (!q) return true;
    return (
      (p.invoices?.invoice_number || "").toLowerCase().includes(q) ||
      (p.invoices?.customer_name || "").toLowerCase().includes(q) ||
      (p.invoices?.customer_company || "").toLowerCase().includes(q) ||
      (p.note || "").toLowerCase().includes(q)
    );
  });

  const totalReceived = filtered.reduce((s, p) => s + p.amount, 0);
  const now = new Date();
  const thisMonthTotal = payments
    .filter(p => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Every payment recorded against your invoices</p>
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
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by invoice, client, or note…" value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
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
          <p className="text-base font-medium dark:text-gray-400">No payments match your search</p>
          <button onClick={() => setSearchQ("")} className="text-sm text-violet-500 underline mt-1">Clear search</button>
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
