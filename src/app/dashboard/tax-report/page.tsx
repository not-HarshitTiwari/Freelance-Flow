"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdBanner } from "@/components/ads/AdBanner";
import { usePlan } from "@/lib/plan-context";
import { Download, FileText, IndianRupee } from "lucide-react";
import { toast } from "sonner";

type Invoice = {
  invoice_number: string; invoice_date: string; customer_name: string; customer_gstin: string | null;
  subtotal: number; gst_rate: number; tax: number | null; cgst: number | null; sgst: number | null;
  igst: number | null; total: number; gst_type: string; status: string;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const currentYear = new Date().getFullYear();
const QUARTERS = [
  { label: "Q1 (Apr–Jun)", months: [3,4,5] },
  { label: "Q2 (Jul–Sep)", months: [6,7,8] },
  { label: "Q3 (Oct–Dec)", months: [9,10,11] },
  { label: "Q4 (Jan–Mar)", months: [0,1,2] },
];

export default function TaxReportPage() {
  const isPro = usePlan() === "pro";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(0);

  useEffect(() => {
    fetch("/api/invoices")
      .then(r => r.json())
      .then(d => setInvoices(d.invoices || []));
  }, []);

  const qMonths = QUARTERS[quarter].months;
  const filtered = invoices.filter(inv => {
    const d = new Date(inv.invoice_date);
    return d.getFullYear() === year && qMonths.includes(d.getMonth());
  });
  const paid = filtered.filter(i => i.status === "paid");

  const totals = {
    subtotal: paid.reduce((s, i) => s + i.subtotal, 0),
    cgst: paid.reduce((s, i) => s + (i.cgst ?? 0), 0),
    sgst: paid.reduce((s, i) => s + (i.sgst ?? 0), 0),
    igst: paid.reduce((s, i) => s + (i.igst ?? 0), 0),
    gst: paid.reduce((s, i) => s + (i.tax ?? ((i.cgst ?? 0) + (i.sgst ?? 0) + (i.igst ?? 0))), 0),
    total: paid.reduce((s, i) => s + i.total, 0),
  };

  // Monthly breakdown
  const monthly = qMonths.map(m => {
    const mInv = paid.filter(i => new Date(i.invoice_date).getMonth() === m);
    return {
      month: MONTHS[m],
      invoices: mInv.length,
      subtotal: mInv.reduce((s, i) => s + i.subtotal, 0),
      gst: mInv.reduce((s, i) => s + (i.tax ?? ((i.cgst ?? 0) + (i.sgst ?? 0) + (i.igst ?? 0))), 0),
      total: mInv.reduce((s, i) => s + i.total, 0),
    };
  });

  async function downloadCSV() {
    const rows = [
      ["Invoice #", "Date", "Customer", "Customer GSTIN", "Subtotal", "CGST", "SGST", "IGST", "Total GST", "Grand Total", "GST Type"],
      ...paid.map(i => [
        i.invoice_number, i.invoice_date, i.customer_name, i.customer_gstin || "",
        i.subtotal, i.cgst ?? 0, i.sgst ?? 0, i.igst ?? 0, i.tax, i.total, i.gst_type,
      ]),
      [],
      ["TOTAL", "", "", "", totals.subtotal, totals.cgst, totals.sgst, totals.igst, totals.gst, totals.total, ""],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `GST-Report-${QUARTERS[quarter].label.replace(/[^A-Za-z0-9]/g, "-")}-${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  }

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GST Tax Report</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Quarterly summary for GSTR filing</p>
        </div>
        <Button onClick={downloadCSV} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Download size={16} /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={year} onChange={e => setYear(+e.target.value)} className="h-9 rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-3 text-sm outline-none">
          {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y}>{y}</option>)}
        </select>
        <div className="flex gap-2">
          {QUARTERS.map((q, i) => (
            <button key={i} onClick={() => setQuarter(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${quarter === i ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {!isPro && paid.length > 0 && <AdBanner format="horizontal" className="mb-6" />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Taxable Value", value: totals.subtotal, color: "text-gray-900 dark:text-white" },
          { label: "CGST Collected", value: totals.cgst, color: "text-blue-600" },
          { label: "SGST Collected", value: totals.sgst, color: "text-violet-600" },
          { label: "IGST Collected", value: totals.igst, color: "text-orange-600" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color}`}>{fmt(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total GST box */}
      <Card className="mb-6 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Total GST Collected</p>
            <p className="text-3xl font-bold text-violet-700 dark:text-violet-300 mt-1">{fmt(totals.gst)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Grand Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(totals.total)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Monthly breakdown */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm dark:text-white">Monthly Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  {["Month","Invoices","Taxable","GST","Total"].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.month} className="border-b dark:border-gray-800">
                    <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{m.month}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{m.invoices}</td>
                    <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{fmt(m.subtotal)}</td>
                    <td className="py-2.5 pr-4 text-violet-600 dark:text-violet-400">{fmt(m.gst)}</td>
                    <td className="py-2.5 font-semibold text-gray-900 dark:text-white">{fmt(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice-level detail */}
      <Card>
        <CardHeader><CardTitle className="text-sm dark:text-white flex items-center gap-2"><FileText size={15} /> Invoice Detail ({paid.length} paid)</CardTitle></CardHeader>
        <CardContent>
          {paid.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <IndianRupee size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No paid invoices in this quarter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    {["Invoice #","Date","Customer","Taxable","CGST","SGST","IGST","Total"].map(h => (
                      <th key={h} className="text-left py-2 pr-3 font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paid.map(inv => (
                    <tr key={inv.invoice_number} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{inv.invoice_number}</td>
                      <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{inv.customer_name}</td>
                      <td className="py-2 pr-3">{fmt(inv.subtotal)}</td>
                      <td className="py-2 pr-3 text-blue-600">{fmt(inv.cgst ?? 0)}</td>
                      <td className="py-2 pr-3 text-violet-600">{fmt(inv.sgst ?? 0)}</td>
                      <td className="py-2 pr-3 text-orange-600">{fmt(inv.igst ?? 0)}</td>
                      <td className="py-2 font-semibold text-gray-900 dark:text-white">{fmt(inv.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isPro && paid.length > 0 && <AdBanner format="rectangle" className="mt-8 max-w-sm mx-auto" />}
    </div>
  );
}
