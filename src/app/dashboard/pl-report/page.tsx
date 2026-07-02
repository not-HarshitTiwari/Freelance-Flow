"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

type InvoiceRow = {
  id: string;
  invoice_date: string | null;
  total: number;
  status: string;
  amount_paid: number | null;
  invoice_type: string | null;
  customer_name: string | null;
};

type ExpenseRow = {
  id: string;
  date: string;
  amount: number;
  category: string | null;
  description: string | null;
};

function earnedFor(inv: InvoiceRow): number {
  if (inv.status === "paid") return inv.total;
  if (inv.status === "partial") return inv.amount_paid ?? 0;
  return 0;
}

function getPeriodLabel(date: string, mode: string): string {
  const d = new Date(date);
  if (mode === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (mode === "quarterly") return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return String(d.getFullYear());
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PLReportPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [mode, setMode] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices").then(r => r.json()),
      fetch("/api/expenses").then(r => r.json()),
    ]).then(([invData, expData]) => {
      setInvoices(invData.invoices || []);
      setExpenses(expData.expenses || []);
      setLoading(false);
    });
  }, []);

  const years = useMemo(() => {
    const allDates = [
      ...invoices.map(i => i.invoice_date).filter(Boolean),
      ...expenses.map(e => e.date),
    ] as string[];
    if (!allDates.length) return [new Date().getFullYear()];
    const min = Math.min(...allDates.map(d => new Date(d).getFullYear()));
    const max = Math.max(...allDates.map(d => new Date(d).getFullYear()));
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }, [invoices, expenses]);

  const periods = useMemo(() => {
    const filteredInvoices = invoices.filter(
      inv =>
        inv.invoice_type !== "proforma" &&
        inv.invoice_date &&
        new Date(inv.invoice_date).getFullYear() === year
    );
    const filteredExpenses = expenses.filter(
      exp => exp.date && new Date(exp.date).getFullYear() === year
    );

    const map = new Map<string, { revenue: number; expenses: number; expensesByCategory: Record<string, number> }>();

    for (const inv of filteredInvoices) {
      if (!inv.invoice_date) continue;
      const key = getPeriodLabel(inv.invoice_date, mode);
      if (!map.has(key)) map.set(key, { revenue: 0, expenses: 0, expensesByCategory: {} });
      map.get(key)!.revenue += earnedFor(inv);
    }

    for (const exp of filteredExpenses) {
      const key = getPeriodLabel(exp.date, mode);
      if (!map.has(key)) map.set(key, { revenue: 0, expenses: 0, expensesByCategory: {} });
      const entry = map.get(key)!;
      entry.expenses += exp.amount;
      const cat = exp.category || "Uncategorized";
      entry.expensesByCategory[cat] = (entry.expensesByCategory[cat] || 0) + exp.amount;
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({ period, ...data, net: data.revenue - data.expenses }));
  }, [invoices, expenses, mode, year]);

  const totals = useMemo(() => {
    const revenue = periods.reduce((s, p) => s + p.revenue, 0);
    const exp = periods.reduce((s, p) => s + p.expenses, 0);
    return { revenue, expenses: exp, net: revenue - exp };
  }, [periods]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of periods) Object.keys(p.expensesByCategory).forEach(c => cats.add(c));
    return [...cats].sort();
  }, [periods]);

  function exportCSV() {
    const catHeaders = allCategories.map(c => `Expense: ${c}`);
    const header = ["Period", "Revenue (₹)", "Total Expenses (₹)", ...catHeaders, "Net Profit (₹)"];
    const rows = periods.map(p => [
      p.period,
      p.revenue.toFixed(2),
      p.expenses.toFixed(2),
      ...allCategories.map(c => (p.expensesByCategory[c] || 0).toFixed(2)),
      p.net.toFixed(2),
    ]);
    rows.push([
      "TOTAL",
      totals.revenue.toFixed(2),
      totals.expenses.toFixed(2),
      ...allCategories.map(c =>
        periods.reduce((s, p) => s + (p.expensesByCategory[c] || 0), 0).toFixed(2)
      ),
      totals.net.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pl-report-${year}-${mode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cardClass = "rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 p-5";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">P&amp;L Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Profit &amp; Loss — revenue vs expenses by period</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2 dark:border-gray-600 dark:text-gray-300">
          <Download size={15} /> Export CSV
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1.5">
          {(["monthly", "quarterly", "yearly"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${mode === m ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="h-8 rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-500" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Revenue</p>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fmt(totals.revenue)}</p>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} className="text-red-500" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Expenses</p>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(totals.expenses)}</p>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className={totals.net >= 0 ? "text-violet-500" : "text-orange-500"} />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Net Profit</p>
              </div>
              <p className={`text-2xl font-bold ${totals.net >= 0 ? "text-violet-600 dark:text-violet-400" : "text-orange-600 dark:text-orange-400"}`}>
                {fmt(totals.net)}
              </p>
            </div>
          </div>

          {/* P&L table */}
          {periods.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-600">
              <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium dark:text-gray-400">No data for {year}</p>
              <p className="text-sm">Create some invoices or log expenses to see your P&amp;L</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-left">
                    <th className="px-4 py-3 font-semibold">Period</th>
                    <th className="px-4 py-3 font-semibold text-right">Revenue</th>
                    <th className="px-4 py-3 font-semibold text-right">Expenses</th>
                    {allCategories.map(c => (
                      <th key={c} className="px-4 py-3 font-semibold text-right whitespace-nowrap text-xs">{c}</th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-right">Net Profit</th>
                    <th className="px-4 py-3 font-semibold text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p, i) => {
                    const margin = p.revenue > 0 ? (p.net / p.revenue) * 100 : 0;
                    return (
                      <tr key={p.period} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/30"}`}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.period}</td>
                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{fmt(p.revenue)}</td>
                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{fmt(p.expenses)}</td>
                        {allCategories.map(c => (
                          <td key={c} className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs">
                            {p.expensesByCategory[c] ? fmt(p.expensesByCategory[c]) : "—"}
                          </td>
                        ))}
                        <td className={`px-4 py-3 text-right font-semibold ${p.net >= 0 ? "text-violet-600 dark:text-violet-400" : "text-orange-600 dark:text-orange-400"}`}>
                          {fmt(p.net)}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {p.revenue > 0 ? `${margin.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{fmt(totals.revenue)}</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{fmt(totals.expenses)}</td>
                    {allCategories.map(c => (
                      <td key={c} className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 text-xs">
                        {fmt(periods.reduce((s, p) => s + (p.expensesByCategory[c] || 0), 0))}
                      </td>
                    ))}
                    <td className={`px-4 py-3 text-right ${totals.net >= 0 ? "text-violet-600 dark:text-violet-400" : "text-orange-600 dark:text-orange-400"}`}>
                      {fmt(totals.net)}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs ${totals.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {totals.revenue > 0 ? `${((totals.net / totals.revenue) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
