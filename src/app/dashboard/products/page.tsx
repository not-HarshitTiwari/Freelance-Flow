"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Package, AlertTriangle, Download, Upload } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  description: string | null;
  type: "product" | "service";
  unit_price: number;
  unit: string | null;
  hsn_code: string | null;
  track_inventory: boolean;
  quantity: number | null;
  low_stock_threshold: number | null;
  margin_pct: number | null;
};

const empty = {
  name: "", description: "", type: "service" as "product" | "service",
  unit_price: "", unit: "unit", hsn_code: "", track_inventory: false, quantity: "", low_stock_threshold: "3",
  margin_pct: "100",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products || []);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? "PATCH" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      const res = await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(editing ? "Updated!" : "Added!");
      setOpen(false);
      setEditing(null);
      setForm(empty);
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Deleted");
    fetchProducts();
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "", type: p.type,
      unit_price: String(p.unit_price), unit: p.unit || "unit", hsn_code: p.hsn_code || "",
      track_inventory: p.track_inventory, quantity: p.quantity != null ? String(p.quantity) : "",
      low_stock_threshold: p.low_stock_threshold != null ? String(p.low_stock_threshold) : "3",
      margin_pct: p.margin_pct != null ? String(p.margin_pct) : "100",
    });
    setOpen(true);
  }

  function exportCSV() {
    const rows = [["Name", "Type", "Price", "Unit", "HSN/SAC", "Description", "Track Inventory", "Quantity"]];
    for (const p of products) {
      rows.push([
        p.name, p.type, String(p.unit_price), p.unit || "", p.hsn_code || "", p.description || "",
        p.track_inventory ? "yes" : "no", p.quantity != null ? String(p.quantity) : "",
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "products.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(f => f.trim() !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); if (row.some(f => f.trim() !== "")) rows.push(row); }
    return rows;
  }

  async function importCSV(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("CSV file is empty");

      const header = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      const idx = (name: string) => header.indexOf(name);

      let imported = 0;
      let failed = 0;
      for (const r of dataRows) {
        const name = r[idx("name")]?.trim();
        if (!name) { failed++; continue; }
        const type = r[idx("type")]?.trim().toLowerCase() === "product" ? "product" : "service";
        const track = ["yes", "true", "1"].includes((r[idx("track inventory")] || "").trim().toLowerCase());
        const qty = r[idx("quantity")]?.trim();

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            type,
            unit_price: parseFloat(r[idx("price")]) || 0,
            unit: r[idx("unit")]?.trim() || "unit",
            hsn_code: r[idx("hsn/sac")]?.trim() || "",
            description: r[idx("description")]?.trim() || "",
            track_inventory: track,
            quantity: qty || "",
          }),
        });
        const data = await res.json();
        if (data.error) failed++; else imported++;
      }

      toast.success(`Imported ${imported} item${imported === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`);
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products & Services</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your catalog — pick items straight onto an invoice instead of retyping them</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f); }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium px-3 h-8 rounded-lg transition-colors disabled:opacity-50"
          >
            <Upload size={15} /> {importing ? "Importing..." : "Import CSV"}
          </button>
          {products.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium px-3 h-8 rounded-lg transition-colors">
              <Download size={15} /> Export CSV
            </button>
          )}
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Plus size={16} /> Add Item
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? "Edit Item" : "Add Item"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input placeholder="Logo Design" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  value={form.type}
                  onChange={e => {
                    const type = e.target.value as "product" | "service";
                    setForm(f => ({ ...f, type, track_inventory: type === "product" ? f.track_inventory : false }));
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none"
                >
                  <option value="service">Service (no stock count)</option>
                  <option value="product">Product</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Price (₹) *</Label>
                  <Input type="number" min="0" step="0.01" placeholder="1999" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Input placeholder="hr, pc, unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>HSN/SAC Code</Label>
                <Input placeholder="Optional" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Profit Margin (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="100"
                  value={form.margin_pct}
                  onChange={e => setForm({ ...form, margin_pct: e.target.value })}
                />
              </div>
              {form.type === "product" && (
                <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={form.track_inventory} onChange={e => setForm({ ...form, track_inventory: e.target.checked })} />
                    Track stock for this product
                  </label>
                  {form.track_inventory && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Quantity in stock</Label>
                        <Input type="number" min="0" step="1" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Low-stock alert at</Label>
                        <Input type="number" min="0" step="1" placeholder="3" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Item"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No products or services yet</p>
          <p className="text-sm">Add your first item to reuse it on invoices</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const outOfStock = p.track_inventory && (p.quantity ?? 0) <= 0;
            const lowStock = p.track_inventory && !outOfStock && (p.quantity ?? 0) <= (p.low_stock_threshold ?? 3);
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <Package size={15} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                        {p.type === "product" ? "Product" : "Service"} • ₹{p.unit_price.toLocaleString("en-IN")}/{p.unit || "unit"}
                        {p.track_inventory && (
                          <span className={outOfStock || lowStock ? "text-red-500 flex items-center gap-1" : ""}>
                            {(outOfStock || lowStock) && <AlertTriangle size={11} />}
                            • {outOfStock ? "Out of stock" : lowStock ? `Low stock — ${p.quantity} left` : `${p.quantity} in stock`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"><Pencil size={14} /></button>
                    <button onClick={() => deleteProduct(p.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
