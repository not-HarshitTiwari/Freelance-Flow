"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, IndianRupee, Pencil } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import { usePlan } from "@/lib/plan-context";
import { toast } from "sonner";

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string | null;
};

const CATEGORIES = ["Software", "Hardware", "Marketing", "Travel", "Office", "Freelancer", "Tax", "Other"];

const empty = { title: "", amount: "", category: "Software", date: new Date().toISOString().slice(0, 10), notes: "" };

export default function ExpensesPage() {
  const isPro = usePlan() === "pro";
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const fetchExpenses = useCallback(async () => {
    const res = await fetch("/api/expenses");
    const data = await res.json();
    setExpenses(data.expenses || []);
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? "PATCH" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      const res = await fetch("/api/expenses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(editing ? "Expense updated!" : "Expense added!");
      setOpen(false);
      setEditing(null);
      setForm(empty);
      fetchExpenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Deleted");
    fetchExpenses();
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({ title: e.title, amount: String(e.amount), category: e.category, date: e.date, notes: e.notes || "" });
    setOpen(true);
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track what you spend — see real profit</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Plus size={16} /> Add Expense
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input placeholder="Adobe Creative Cloud" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" min="0" step="0.01" placeholder="1999" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input placeholder="Optional note" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₹{total.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        {Object.entries(byCategory).slice(0, 3).map(([cat, amt]) => (
          <Card key={cat}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{cat}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">₹{amt.toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isPro && expenses.length > 0 && <AdBanner format="horizontal" className="mb-6" />}

      {expenses.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <IndianRupee size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No expenses yet</p>
          <p className="text-sm">Log your first expense to track profit</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e, i) => (
            <div key={e.id}>
              {!isPro && i > 0 && i % 5 === 0 && <AdBanner format="rectangle" className="my-3" />}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <IndianRupee size={15} className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{e.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {e.category} • {new Date(e.date).toLocaleDateString("en-IN")}
                        {e.notes && ` • ${e.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-red-500">−₹{e.amount.toLocaleString("en-IN")}</span>
                    <button onClick={() => openEdit(e)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"><Pencil size={14} /></button>
                    <button onClick={() => deleteExpense(e.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
