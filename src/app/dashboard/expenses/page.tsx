"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, IndianRupee, Pencil, Download, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdBanner } from "@/components/ads/AdBanner";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import { toast } from "sonner";

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurrence_interval: string | null;
  next_expense_date: string | null;
};

const CATEGORIES = ["Software", "Hardware", "Marketing", "Travel", "Office", "Freelancer", "Tax", "Other"];

const empty = {
  title: "", amount: "", category: "Software", date: new Date().toISOString().slice(0, 10), notes: "", receipt_url: "",
  is_recurring: false, recurrence_interval: "monthly", next_expense_date: "",
};

export default function ExpensesPage() {
  const plan = usePlan();
  const isPro = plan !== "free";
  const canUploadReceipt = planAtLeast(plan, "basic");
  const canExportCSV = planAtLeast(plan, "basic");
  const canRecur = planAtLeast(plan, "pro");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

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
    setForm({
      title: e.title, amount: String(e.amount), category: e.category, date: e.date, notes: e.notes || "", receipt_url: e.receipt_url || "",
      is_recurring: e.is_recurring || false, recurrence_interval: e.recurrence_interval || "monthly", next_expense_date: e.next_expense_date || "",
    });
    setOpen(true);
  }

  async function uploadReceipt(file: File) {
    setUploadingReceipt(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const ext = file.name.split(".").pop();
      const path = `receipts/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
      setForm(f => ({ ...f, receipt_url: publicUrl }));
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploadingReceipt(false); }
  }

  function exportCSV() {
    const rows = [["Date", "Title", "Category", "Amount (₹)", "Notes", "Receipt"]];
    for (const e of filteredExpenses) {
      rows.push([e.date, e.title, e.category, String(e.amount), e.notes || "", e.receipt_url || ""]);
    }
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "expenses.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const [monthFilter, setMonthFilter] = useState("");

  const filteredExpenses = monthFilter
    ? expenses.filter(e => e.date.startsWith(monthFilter))
    : expenses;

  const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const byCategory = filteredExpenses.reduce<Record<string, number>>((acc, e) => {
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
        <div className="flex gap-2">
          {expenses.length > 0 && canExportCSV && (
            <button onClick={exportCSV} className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium px-3 h-8 rounded-lg transition-colors">
              <Download size={15} /> Export CSV
            </button>
          )}
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
              {canRecur ? (
                <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_recurring}
                      onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Make this a recurring expense
                  </label>
                  {form.is_recurring && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Repeats</Label>
                        <select value={form.recurrence_interval} onChange={e => setForm({ ...form, recurrence_interval: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Next date</Label>
                        <Input type="date" value={form.next_expense_date} onChange={e => setForm({ ...form, next_expense_date: e.target.value })} required={form.is_recurring} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Recurring expenses are available on the Pro plan and above.
                </p>
              )}
              {canUploadReceipt && (
              <div className="space-y-1.5">
                <Label>Receipt</Label>
                {form.receipt_url ? (
                  <div className="flex items-center gap-2">
                    <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 underline truncate flex-1">View receipt</a>
                    <button type="button" onClick={() => setForm(f => ({ ...f, receipt_url: "" }))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:border-violet-400 transition-colors">
                    <Paperclip size={14} />
                    {uploadingReceipt ? "Uploading..." : "Attach receipt (image/PDF)"}
                    <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingReceipt} onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); }} />
                  </label>
                )}
              </div>
              )}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving || uploadingReceipt}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
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

      {/* Category breakdown chart */}
      {Object.keys(byCategory).length > 1 && (
        <div className="mb-6 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Spending by Category</p>
          <div className="space-y-2.5">
            {Object.entries(byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">{cat}</span>
                    <span className="text-gray-900 dark:text-white font-semibold">₹{amt.toLocaleString("en-IN")} <span className="text-gray-400 font-normal">({Math.round((amt / total) * 100)}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all"
                      style={{ width: `${(amt / total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!isPro && expenses.length > 0 && <AdBanner format="horizontal" className="mb-6" />}

      {expenses.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-500 dark:text-gray-400 shrink-0">Month:</label>
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="h-8 text-sm w-40" />
          {monthFilter && <button onClick={() => setMonthFilter("")} className="text-xs text-violet-500 underline">Clear</button>}
          {monthFilter && <span className="text-xs text-gray-400">{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <IndianRupee size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No expenses yet</p>
          <p className="text-sm">Log your first expense to track profit</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
          <p className="text-base font-medium dark:text-gray-400">No expenses in this period</p>
          <button onClick={() => setMonthFilter("")} className="text-sm text-violet-500 underline mt-1">Clear filter</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((e, i) => (
            <div key={e.id}>
              {!isPro && i > 0 && i % 5 === 0 && <AdBanner format="rectangle" className="my-3" />}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <IndianRupee size={15} className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        {e.title}
                        {e.is_recurring && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                            Recurring
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {e.category} • {new Date(e.date).toLocaleDateString("en-IN")}
                        {e.notes && ` • ${e.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-red-500">−₹{e.amount.toLocaleString("en-IN")}</span>
                    {e.receipt_url && (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" title="View receipt" className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400">
                        <Paperclip size={14} />
                      </a>
                    )}
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
