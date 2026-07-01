"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowLeft, Receipt, IndianRupee } from "lucide-react";

type Client = { id: string; name: string; email: string; phone: string | null; company: string | null };
type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  amount_paid: number | null;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_company: string | null;
};
type Payment = { id: string; invoice_id: string; amount: number; note: string | null; paid_at: string };

type Group = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  isSavedClient: boolean;
  invoices: Invoice[];
  payments: (Payment & { invoice_number: string })[];
};

function keyFor(email: string | null, name: string | null): string {
  return (email?.trim().toLowerCase()) || `name:${(name || "unknown").trim().toLowerCase()}`;
}

export function ClientLedgerClient({ clients, invoices, payments }: { clients: Client[]; invoices: Invoice[]; payments: Payment[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const invoiceById = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();

    for (const c of clients) {
      const key = keyFor(c.email, c.name);
      map.set(key, { key, name: c.name, email: c.email || null, phone: c.phone, company: c.company, isSavedClient: true, invoices: [], payments: [] });
    }

    for (const inv of invoices) {
      const key = keyFor(inv.customer_email, inv.customer_name);
      let g = map.get(key);
      if (!g) {
        g = { key, name: inv.customer_name || "Unknown", email: inv.customer_email, phone: null, company: inv.customer_company, isSavedClient: false, invoices: [], payments: [] };
        map.set(key, g);
      }
      g.invoices.push(inv);
    }

    for (const p of payments) {
      const inv = invoiceById.get(p.invoice_id);
      if (!inv) continue;
      const key = keyFor(inv.customer_email, inv.customer_name);
      const g = map.get(key);
      if (g) g.payments.push({ ...p, invoice_number: inv.invoice_number });
    }

    return [...map.values()]
      .filter(g => g.invoices.length > 0 || g.isSavedClient)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, invoices, invoiceById, payments]);

  const active = groups.find(g => g.key === selected) || null;

  if (active) {
    const totalInvoiced = active.invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = active.invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
    const balance = totalInvoiced - totalPaid;

    type Row = { date: string; label: string; debit: number; credit: number };
    const rows: Row[] = [
      ...active.invoices.map(i => ({ date: i.invoice_date, label: `Invoice ${i.invoice_number}`, debit: i.total, credit: 0 })),
      ...active.payments.map(p => ({ date: p.paid_at, label: `Payment — ${p.invoice_number}${p.note ? ` (${p.note})` : ""}`, debit: 0, credit: p.amount })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const withRunning = rows.map(r => {
      running += r.debit - r.credit;
      return { ...r, running };
    });

    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 mb-4">
          <ArrowLeft size={15} /> Back to all clients
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{active.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{active.email || active.company || "No contact info on file"}</p>
          </div>
          <Badge className={balance > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}>
            {balance > 0 ? `₹${balance.toLocaleString("en-IN")} due` : "Settled"}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">Total Invoiced</p><p className="text-lg font-bold text-gray-900 dark:text-white">₹{totalInvoiced.toLocaleString("en-IN")}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">Total Paid</p><p className="text-lg font-bold text-green-600">₹{totalPaid.toLocaleString("en-IN")}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500 mb-1">Outstanding Balance</p><p className="text-lg font-bold text-amber-600">₹{balance.toLocaleString("en-IN")}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 uppercase">
                  <th className="p-3">Date</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {withRunning.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">No transactions yet</td></tr>
                )}
                {withRunning.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="p-3 text-gray-500">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                    <td className="p-3 text-gray-900 dark:text-gray-100">{r.label}</td>
                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">{r.debit ? `₹${r.debit.toLocaleString("en-IN")}` : ""}</td>
                    <td className="p-3 text-right text-green-600">{r.credit ? `₹${r.credit.toLocaleString("en-IN")}` : ""}</td>
                    <td className="p-3 text-right font-medium text-gray-900 dark:text-white">₹{r.running.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users size={20} /> Client Ledger</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Running balance per client, aggregated from invoices and recorded payments</p>
      </div>

      <div className="space-y-2">
        {groups.length === 0 && (
          <Card><CardContent className="p-8 text-center text-gray-400">No clients or invoices yet</CardContent></Card>
        )}
        {groups.map(g => {
          const totalInvoiced = g.invoices.reduce((s, i) => s + i.total, 0);
          const totalPaid = g.invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
          const balance = totalInvoiced - totalPaid;
          return (
            <Card key={g.key} className="cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-colors" onClick={() => setSelected(g.key)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {g.name}
                    {!g.isSavedClient && <Badge variant="outline" className="text-[10px]">one-off</Badge>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <Receipt size={12} /> {g.invoices.length} invoice{g.invoices.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold flex items-center gap-1 justify-end ${balance > 0 ? "text-amber-600" : "text-green-600"}`}>
                    <IndianRupee size={14} />{balance.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-gray-400">{balance > 0 ? "due" : "settled"}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
