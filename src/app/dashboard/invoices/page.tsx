"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

type InvoiceItem = { description: string; quantity: number; rate: number };
type Invoice = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string | null;
  created_at: string;
  clients: { name: string; email: string } | null;
};

const statusColors: Record<string, string> = {
  unpaid: "bg-orange-100 text-orange-600",
  paid: "bg-green-100 text-green-600",
  overdue: "bg-red-100 text-red-600",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, rate: 0 },
  ]);
  const [form, setForm] = useState({ clientEmail: "", tax: "0", dueDate: "" });

  const fetchInvoices = useCallback(async () => {
    const res = await fetch("/api/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  function addItem() {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax = (subtotal * parseFloat(form.tax || "0")) / 100;
  const total = subtotal + tax;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, tax: parseFloat(form.tax), dueDate: form.dueDate }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Invoice ${data.invoice.invoice_number} created!`);
      setOpen(false);
      setItems([{ description: "", quantity: 1, rate: 0 }]);
      setForm({ clientEmail: "", tax: "0", dueDate: "" });
      fetchInvoices();
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(id: string) {
    await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "paid" }),
    });
    toast.success("Marked as paid!");
    fetchInvoices();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">Create and track your invoices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
              <Plus size={16} /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-3">
                <Label className="font-semibold">Line Items</Label>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="Rate ₹"
                        min={0}
                        value={item.rate}
                        onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)}>
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus size={14} /> Add Item
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>GST / Tax (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.tax}
                    onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({form.tax}%)</span>
                  <span>₹{tax.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={saving}>
                {saving ? "Creating..." : "Create Invoice"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Receipt size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No invoices yet</p>
          <p className="text-sm">Create your first invoice to get paid</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {inv.clients?.name || "No client"} •{" "}
                    {new Date(inv.created_at).toLocaleDateString("en-IN")}
                    {inv.due_date && ` • Due ${new Date(inv.due_date).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">
                    ₹{inv.total.toLocaleString("en-IN")}
                  </span>
                  <Badge className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                  {inv.status === "unpaid" && (
                    <Button size="sm" variant="outline" onClick={() => markPaid(inv.id)}>
                      Mark Paid
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
