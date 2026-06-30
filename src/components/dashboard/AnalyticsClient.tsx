"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, TrendingUp, Receipt, Users, BarChart3 } from "lucide-react";
import { RevenueExpenseChart } from "@/components/dashboard/RevenueExpenseChart";
import { AdBanner } from "@/components/ads/AdBanner";

type InvRow = {
  total: number;
  status: string;
  invoice_date: string;
  created_at: string;
  customer_name: string | null;
  customer_company: string | null;
  amount_paid: number | null;
};
type ExpRow = { amount: number; date: string; category: string };

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "24M", months: 24 },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#d97706",
  unpaid: "#7c3aed",
  overdue: "#dc2626",
};

function earnedFor(i: InvRow) {
  return i.status === "paid" ? i.total : i.status === "partial" ? (i.amount_paid ?? 0) : 0;
}

export function AnalyticsClient({ invoices, expenses, isFree }: { invoices: InvRow[]; expenses: ExpRow[]; isFree: boolean }) {
  const [rangeMonths, setRangeMonths] = useState(6);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - rangeMonths + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [rangeMonths]);

  const rangeInvoices = useMemo(
    () => invoices.filter(i => new Date(i.invoice_date || i.created_at) >= cutoff),
    [invoices, cutoff]
  );
  const rangeExpenses = useMemo(() => expenses.filter(e => new Date(e.date) >= cutoff), [expenses, cutoff]);

  const totalRevenue = rangeInvoices.reduce((s, i) => s + earnedFor(i), 0);
  const totalExpenses = rangeExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const outstanding = rangeInvoices.reduce(
    (s, i) => s + (i.status === "unpaid" || i.status === "overdue" ? i.total : i.status === "partial" ? i.total - (i.amount_paid ?? 0) : 0),
    0
  );
  const avgInvoiceValue = rangeInvoices.length > 0 ? rangeInvoices.reduce((s, i) => s + i.total, 0) / rangeInvoices.length : 0;

  const monthly = useMemo(() => {
    const months: { month: string; revenue: number; expenses: number }[] = [];
    for (let idx = rangeMonths - 1; idx >= 0; idx--) {
      const d = new Date();
      d.setMonth(d.getMonth() - idx);
      const label = d.toLocaleString("en-IN", { month: "short", ...(rangeMonths > 12 ? { year: "2-digit" as const } : {}) });
      const y = d.getFullYear(), m = d.getMonth();
      const mInv = invoices.filter(i => {
        const dt = new Date(i.invoice_date || i.created_at);
        return dt.getFullYear() === y && dt.getMonth() === m;
      });
      const mExp = expenses.filter(e => {
        const dt = new Date(e.date);
        return dt.getFullYear() === y && dt.getMonth() === m;
      });
      months.push({
        month: label,
        revenue: mInv.reduce((s, i) => s + earnedFor(i), 0),
        expenses: mExp.reduce((s, e) => s + e.amount, 0),
      });
    }
    return months;
  }, [invoices, expenses, rangeMonths]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {};
    for (const i of rangeInvoices) {
      const key = i.status || "unpaid";
      if (!counts[key]) counts[key] = { count: 0, amount: 0 };
      counts[key].count++;
      counts[key].amount += i.total;
    }
    const totalAmount = Object.values(counts).reduce((s, c) => s + c.amount, 0) || 1;
    return Object.entries(counts)
      .map(([status, v]) => ({ status, ...v, pct: (v.amount / totalAmount) * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [rangeInvoices]);

  const categoryBreakdown = useMemo(() => {
    const byCategory = rangeExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});
    const max = Math.max(...Object.values(byCategory), 1);
    return Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount, pct: (amount / max) * 100 }));
  }, [rangeExpenses]);

  const topClients = useMemo(() => {
    const byClient = rangeInvoices
      .filter(i => i.status === "paid")
      .reduce<Record<string, number>>((acc, i) => {
        const name = i.customer_name || i.customer_company || "Unknown";
        acc[name] = (acc[name] || 0) + i.total;
        return acc;
      }, {});
    const max = Math.max(...Object.values(byClient), 1);
    return Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, amount]) => ({ name, amount, pct: (amount / max) * 100 }));
  }, [rangeInvoices]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Revenue, expenses and client trends</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {RANGES.map(r => (
            <button
              key={r.months}
              onClick={() => setRangeMonths(r.months)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                rangeMonths === r.months
                  ? "bg-violet-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <IndianRupee size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{totalRevenue.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <Receipt size={18} className="text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{totalExpenses.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${netProfit >= 0 ? "bg-violet-100 dark:bg-violet-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
                <TrendingUp size={18} className={netProfit >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-500"} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Net Profit ({profitMargin.toFixed(0)}% margin)</p>
                <p className={`text-xl font-bold ${netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-500"}`}>₹{netProfit.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Receipt size={18} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{outstanding.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Invoice Value</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{avgInvoiceValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Receipt size={18} className="text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Invoices in range</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{rangeInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 dark:text-white">
            <TrendingUp size={16} className="text-violet-600" /> Revenue vs Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueExpenseChart data={monthly} />
        </CardContent>
      </Card>

      {isFree && <AdBanner format="horizontal" className="mb-8" />}

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {statusBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base dark:text-white">Invoice Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusBreakdown.map(s => (
                <div key={s.status} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium capitalize">{s.status} ({s.count})</span>
                    <span className="text-gray-900 dark:text-white font-semibold">₹{s.amount.toLocaleString("en-IN")} · {s.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: STATUS_COLORS[s.status] || "#6b7280" }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base dark:text-white">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryBreakdown.map(c => (
                <div key={c.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{c.category}</span>
                    <span className="text-gray-900 dark:text-white font-semibold">₹{c.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {topClients.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 dark:text-white">
              <Users size={16} className="text-violet-600" /> Top Clients by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topClients.map(c => (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-xs">{c.name}</span>
                  <span className="text-gray-900 dark:text-white font-semibold shrink-0 ml-4">₹{c.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isFree && <AdBanner format="rectangle" className="max-w-sm mx-auto" />}
    </div>
  );
}
