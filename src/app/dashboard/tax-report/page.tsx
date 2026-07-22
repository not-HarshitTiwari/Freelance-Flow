"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdBanner } from "@/components/ads/AdBanner";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import { Download, FileText, IndianRupee, FileSpreadsheet, BookOpen } from "lucide-react";
import { toast } from "sonner";

type Invoice = {
  invoice_number: string; invoice_date: string; customer_name: string; customer_gstin: string | null;
  subtotal: number; gst_rate: number; tax: number | null; cgst: number | null; sgst: number | null;
  igst: number | null; total: number; gst_type: string; status: string;
  amount_paid?: number | null; due_date?: string | null; invoice_type?: string | null;
};

type Expense = { title: string; amount: number; category: string; date: string };

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const currentYear = new Date().getFullYear();
const QUARTERS = [
  { label: "Q1 (Apr–Jun)", months: [3,4,5] },
  { label: "Q2 (Jul–Sep)", months: [6,7,8] },
  { label: "Q3 (Oct–Dec)", months: [9,10,11] },
  { label: "Q4 (Jan–Mar)", months: [0,1,2] },
];

export default function TaxReportPage() {
  const plan = usePlan();
  const isPro = planAtLeast(plan, "pro");
  const canExportAccounting = planAtLeast(plan, "basic");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(0);

  useEffect(() => {
    fetch("/api/invoices")
      .then(r => r.json())
      .then(d => setInvoices(d.invoices || []));
    fetch("/api/expenses")
      .then(r => r.json())
      .then(d => setExpenses(d.expenses || []));
  }, []);

  const qMonths = QUARTERS[quarter].months;
  const filtered = invoices.filter(inv => {
    const d = new Date(inv.invoice_date);
    return d.getFullYear() === year && qMonths.includes(d.getMonth());
  });
  const paid = filtered.filter(i => i.status === "paid");
  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && qMonths.includes(d.getMonth());
  });

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
    const csv = rows.map(r => r.map(v => csvEscape(v == null ? "" : v)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `GST-Report-${QUARTERS[quarter].label.replace(/[^A-Za-z0-9]/g, "-")}-${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  }

  function downloadFile(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  }

  // GSTR-1 (outward supplies) — B2B invoices sheet + B2C(Small) summary sheet,
  // matching the column layout of the GST portal's offline GSTR-1 Excel tool.
  function downloadGSTR1CSV() {
    const b2b = paid.filter(i => i.customer_gstin);
    const b2c = paid.filter(i => !i.customer_gstin);

    const rows: (string | number)[][] = [
      [`GSTR-1 — ${QUARTERS[quarter].label} ${year}`],
      [],
      ["B2B Invoices"],
      ["GSTIN/UIN of Recipient", "Invoice Number", "Invoice Date", "Invoice Value", "Place of Supply (State Code)", "Reverse Charge", "Invoice Type", "Rate (%)", "Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax", "Cess"],
      ...b2b.map(i => [
        i.customer_gstin || "", i.invoice_number, i.invoice_date, i.total,
        (i.customer_gstin || "").slice(0, 2), "N", "Regular B2B", i.gst_rate,
        i.subtotal, i.igst ?? 0, i.cgst ?? 0, i.sgst ?? 0, 0,
      ]),
      [],
      ["B2C (Small) Summary — grouped by tax rate"],
      ["Type", "Place of Supply", "Rate (%)", "Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax", "Cess"],
    ];

    const b2cGroups = new Map<string, { rate: number; intraState: boolean; taxable: number; igst: number; cgst: number; sgst: number }>();
    for (const i of b2c) {
      const intraState = i.gst_type !== "igst";
      const key = `${i.gst_rate}-${intraState}`;
      const g = b2cGroups.get(key) || { rate: i.gst_rate, intraState, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
      g.taxable += i.subtotal; g.igst += i.igst ?? 0; g.cgst += i.cgst ?? 0; g.sgst += i.sgst ?? 0;
      b2cGroups.set(key, g);
    }
    for (const g of b2cGroups.values()) {
      rows.push(["B2C (Small)", g.intraState ? "Same state as business (assumed)" : "Other state (verify)", g.rate, g.taxable, g.igst, g.cgst, g.sgst, 0]);
    }
    rows.push([]);
    rows.push(["Note: Place of Supply for B2C invoices is approximated from GST type — verify against the customer's actual billing state before filing."]);

    downloadFile(rows.map(r => r.map(csvEscape).join(",")).join("\n"), `GSTR-1-${QUARTERS[quarter].label.replace(/[^A-Za-z0-9]/g, "-")}-${year}.csv`);
    toast.success("GSTR-1 export downloaded!");
  }

  // GSTR-3B (Table 3.1) — outward taxable supplies summary
  function downloadGSTR3BCSV() {
    const rows: (string | number)[][] = [
      [`GSTR-3B — Table 3.1 Outward Supplies — ${QUARTERS[quarter].label} ${year}`],
      [],
      ["Nature of Supplies", "Total Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax", "Cess"],
      ["(a) Outward taxable supplies (other than zero rated, nil rated and exempted)", totals.subtotal, totals.igst, totals.cgst, totals.sgst, 0],
      ["(b) Outward taxable supplies (zero rated)", 0, 0, 0, 0, 0],
      ["(c) Other outward supplies (Nil rated, exempted)", 0, 0, 0, 0, 0],
      ["(d) Inward supplies (liable to reverse charge)", 0, 0, 0, 0, 0],
      ["(e) Non-GST outward supplies", 0, 0, 0, 0, 0],
      [],
      ["Total Tax Liability", totals.subtotal, totals.igst, totals.cgst, totals.sgst, 0],
    ];
    downloadFile(rows.map(r => r.map(csvEscape).join(",")).join("\n"), `GSTR-3B-${QUARTERS[quarter].label.replace(/[^A-Za-z0-9]/g, "-")}-${year}.csv`);
    toast.success("GSTR-3B export downloaded!");
  }

  // Double-entry ledger CSV (Tally/Zoho Books/QuickBooks compatible voucher import)
  function downloadAccountingCSV() {
    const rows: (string | number)[][] = [
      ["Date", "Voucher Type", "Voucher No", "Ledger Name", "Particulars", "Debit", "Credit", "Narration"],
    ];

    for (const inv of paid) {
      const gstSplit = inv.gst_type === "igst" ? [["Output IGST", inv.igst ?? 0]] : [["Output CGST", inv.cgst ?? 0], ["Output SGST", inv.sgst ?? 0]];
      rows.push([inv.invoice_date, "Sales", inv.invoice_number, inv.customer_name, "Sundry Debtors", inv.total, "", `Sales to ${inv.customer_name}`]);
      rows.push([inv.invoice_date, "Sales", inv.invoice_number, "Sales Account", "Direct Income", "", inv.subtotal, ""]);
      for (const [ledger, amt] of gstSplit) {
        if ((amt as number) > 0) rows.push([inv.invoice_date, "Sales", inv.invoice_number, ledger as string, "Duties & Taxes", "", amt, ""]);
      }
    }

    filteredExpenses.forEach((exp, i) => {
      const voucherNo = `EXP-${i + 1}`;
      rows.push([exp.date, "Purchase", voucherNo, exp.category, "Indirect Expenses", exp.amount, "", exp.title]);
      rows.push([exp.date, "Purchase", voucherNo, "Cash/Bank", "Cash-in-hand", "", exp.amount, ""]);
    });

    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Accounting-Export-${QUARTERS[quarter].label.replace(/[^A-Za-z0-9]/g, "-")}-${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Accounting export downloaded!");
  }

  // General Ledger: transactions grouped by account with opening/closing balances per account
  function downloadLedgerReport() {
    const label = `${QUARTERS[quarter].label} ${year}`;
    const generated = new Date().toLocaleDateString("en-IN");
    const rows: (string | number)[][] = [
      [`General Ledger Report — ${label}`],
      [`Generated: ${generated}`],
      [`Note: Opening balances shown as 0 — prior-period balances are not stored in this system.`],
    ];

    const TXCOLS = ["Date", "Reference No.", "Description", "Debit (₹)", "Credit (₹)", "Balance (₹)"];

    // Helper: render one account block into rows
    function accountBlock(
      name: string,
      code: string,
      txns: { date: string; ref: string; desc: string; debit: number; credit: number }[]
    ) {
      const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
      let balance = 0;
      rows.push([], [`Account: ${name}`, `Account No.: ${code}`]);
      rows.push(["Opening Balance", "", "", "", "", 0]);
      rows.push(TXCOLS);
      for (const t of sorted) {
        balance += t.debit - t.credit;
        rows.push([t.date, t.ref, t.desc, t.debit || "", t.credit || "", balance]);
      }
      rows.push(["Closing Balance", "", "", "", "", balance]);
    }

    const activeInvoices = filtered.filter(i => i.invoice_type !== "proforma" && i.status !== "cancelled" && i.status !== "draft");

    // ── 1100  Accounts Receivable ──────────────────────────────────────────────
    // Dr: invoice total when issued  |  Cr: amount received
    {
      const txns: { date: string; ref: string; desc: string; debit: number; credit: number }[] = [];
      for (const inv of activeInvoices) {
        const amtPaid = inv.amount_paid ?? (inv.status === "paid" ? inv.total : 0);
        txns.push({ date: inv.invoice_date, ref: inv.invoice_number, desc: `Invoice — ${inv.customer_name}`, debit: inv.total, credit: 0 });
        if (amtPaid > 0) txns.push({ date: inv.invoice_date, ref: inv.invoice_number, desc: `Payment received — ${inv.customer_name}`, debit: 0, credit: amtPaid });
      }
      accountBlock("Accounts Receivable", "1100", txns);
    }

    // ── 1000  Cash / Bank ──────────────────────────────────────────────────────
    // Dr: payments received from clients  |  Cr: expenses paid out
    {
      const txns: { date: string; ref: string; desc: string; debit: number; credit: number }[] = [];
      for (const inv of activeInvoices) {
        const amtPaid = inv.amount_paid ?? (inv.status === "paid" ? inv.total : 0);
        if (amtPaid > 0) txns.push({ date: inv.invoice_date, ref: inv.invoice_number, desc: `Receipt — ${inv.customer_name}`, debit: amtPaid, credit: 0 });
      }
      filteredExpenses.forEach((exp, i) => {
        txns.push({ date: exp.date, ref: `EXP-${String(i + 1).padStart(3, "0")}`, desc: `${exp.title} (${exp.category})`, debit: 0, credit: exp.amount });
      });
      accountBlock("Cash / Bank", "1000", txns);
    }

    // ── 4000  Sales Revenue ────────────────────────────────────────────────────
    // Cr: taxable value of each invoice (revenue before GST)
    {
      const txns = activeInvoices.map(inv => ({
        date: inv.invoice_date, ref: inv.invoice_number,
        desc: `Sales — ${inv.customer_name}`, debit: 0, credit: inv.subtotal,
      }));
      accountBlock("Sales Revenue", "4000", txns);
    }

    // ── 2100 / 2200 / 2300  GST Payable ───────────────────────────────────────
    // Cr: GST collected (liability to remit to govt)
    const hasCGST = activeInvoices.some(i => (i.cgst ?? 0) > 0);
    const hasSGST = activeInvoices.some(i => (i.sgst ?? 0) > 0);
    const hasIGST = activeInvoices.some(i => (i.igst ?? 0) > 0);
    if (hasCGST) accountBlock("Output CGST Payable", "2100", activeInvoices.filter(i => (i.cgst ?? 0) > 0).map(inv => ({ date: inv.invoice_date, ref: inv.invoice_number, desc: `CGST on ${inv.invoice_number}`, debit: 0, credit: inv.cgst ?? 0 })));
    if (hasSGST) accountBlock("Output SGST Payable", "2200", activeInvoices.filter(i => (i.sgst ?? 0) > 0).map(inv => ({ date: inv.invoice_date, ref: inv.invoice_number, desc: `SGST on ${inv.invoice_number}`, debit: 0, credit: inv.sgst ?? 0 })));
    if (hasIGST) accountBlock("Output IGST Payable", "2300", activeInvoices.filter(i => (i.igst ?? 0) > 0).map(inv => ({ date: inv.invoice_date, ref: inv.invoice_number, desc: `IGST on ${inv.invoice_number}`, debit: 0, credit: inv.igst ?? 0 })));

    // ── 5xxx  Expense Accounts (one per category) ──────────────────────────────
    // Dr: expense amount
    const expByCategory = new Map<string, typeof filteredExpenses>();
    filteredExpenses.forEach((exp, i) => {
      const cat = exp.category || "Other";
      if (!expByCategory.has(cat)) expByCategory.set(cat, []);
      expByCategory.get(cat)!.push(exp);
    });
    const categoryCode: Record<string, string> = {
      Software: "5100", Hardware: "5200", Marketing: "5300", Travel: "5400",
      Office: "5500", Freelancer: "5600", Tax: "5700", Other: "5800",
    };
    let expIdx = 0;
    for (const [cat, exps] of expByCategory) {
      const code = categoryCode[cat] ?? "5900";
      accountBlock(`${cat} Expense`, code, exps.map(exp => ({
        date: exp.date,
        ref: `EXP-${String(++expIdx).padStart(3, "0")}`,
        desc: exp.title,
        debit: exp.amount,
        credit: 0,
      })));
    }

    // ── Trial Balance summary ──────────────────────────────────────────────────
    const totalInvoiced = activeInvoices.reduce((s, i) => s + i.total, 0);
    const totalReceived = activeInvoices.reduce((s, i) => s + (i.amount_paid ?? (i.status === "paid" ? i.total : 0)), 0);
    const totalRevenue = activeInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalGST = activeInvoices.reduce((s, i) => s + (i.tax ?? ((i.cgst ?? 0) + (i.sgst ?? 0) + (i.igst ?? 0))), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    rows.push(
      [], [],
      ["── TRIAL BALANCE SUMMARY ──"],
      ["Account", "Account No.", "Total Debits (₹)", "Total Credits (₹)"],
      ["Accounts Receivable", "1100", totalInvoiced, totalReceived],
      ["Cash / Bank", "1000", totalReceived, totalExpenses],
      ["Sales Revenue", "4000", "", totalRevenue],
      ...(hasCGST ? [["Output CGST Payable", "2100", "", activeInvoices.reduce((s, i) => s + (i.cgst ?? 0), 0)]] : []),
      ...(hasSGST ? [["Output SGST Payable", "2200", "", activeInvoices.reduce((s, i) => s + (i.sgst ?? 0), 0)]] : []),
      ...(hasIGST ? [["Output IGST Payable", "2300", "", activeInvoices.reduce((s, i) => s + (i.igst ?? 0), 0)]] : []),
      [...Array.from(expByCategory.keys()).map(cat => [`${cat} Expense`, categoryCode[cat] ?? "5900", expByCategory.get(cat)!.reduce((s, e) => s + e.amount, 0), ""])].flat(),
      [],
      ["Net Revenue (Sales − Expenses)", "", "", totalRevenue - totalExpenses],
      ["Outstanding Receivables", "", "", totalInvoiced - totalReceived],
      ["Total GST Liability", "", "", totalGST],
    );

    downloadFile(
      rows.map(r => r.map(v => csvEscape(v == null ? "" : v)).join(",")).join("\n"),
      `General-Ledger-${label.replace(/[^A-Za-z0-9]/g, "-")}.csv`
    );
    toast.success("General ledger downloaded!");
  }

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GST Tax Report</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Quarterly summary for GSTR filing</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canExportAccounting && (
            <Button onClick={downloadAccountingCSV} variant="outline" className="gap-2" title="Double-entry ledger CSV compatible with Tally, Zoho Books & QuickBooks">
              <FileSpreadsheet size={16} /> Export for Accounting Software
            </Button>
          )}
          <Button onClick={downloadLedgerReport} variant="outline" className="gap-2" title="Chronological ledger of all invoices & expenses with running balance">
            <BookOpen size={16} /> Export Ledger Report
          </Button>
          <Button onClick={downloadGSTR1CSV} variant="outline" className="gap-2" title="B2B + B2C(Small) summary in the GSTR-1 offline tool column layout">
            <FileText size={16} /> Export GSTR-1
          </Button>
          <Button onClick={downloadGSTR3BCSV} variant="outline" className="gap-2" title="Table 3.1 outward supplies summary">
            <FileText size={16} /> Export GSTR-3B
          </Button>
          <Button onClick={downloadCSV} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Download size={16} /> Export CSV
          </Button>
        </div>
      </div>
      {!canExportAccounting && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-4 mb-6">
          Upgrade to Basic or above to export a Tally/Zoho Books/QuickBooks-compatible ledger CSV.
        </p>
      )}

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
          { label: "CGST Collected", value: totals.cgst, color: "text-blue-600 dark:text-blue-400" },
          { label: "SGST Collected", value: totals.sgst, color: "text-violet-600 dark:text-violet-400" },
          { label: "IGST Collected", value: totals.igst, color: "text-orange-600 dark:text-orange-400" },
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
                  <tr key={`${year}-${quarter}-${m.month}`} className="border-b dark:border-gray-800">
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
                      <td className="py-2 pr-3 text-blue-600 dark:text-blue-400">{fmt(inv.cgst ?? 0)}</td>
                      <td className="py-2 pr-3 text-violet-600 dark:text-violet-400">{fmt(inv.sgst ?? 0)}</td>
                      <td className="py-2 pr-3 text-orange-600 dark:text-orange-400">{fmt(inv.igst ?? 0)}</td>
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
