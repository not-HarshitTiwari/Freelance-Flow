"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Mail, Phone, Building2, MapPin, Trash2, Pencil, Link2, Send, Upload, Download, Loader2 } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const emptyForm = { name: "", email: "", phone: "", company: "", address: "", gstin: "" };

export default function ClientsPage() {
  const plan = usePlan();
  const { ownerId } = useWorkspace();
  const isPro = plan !== "free";
  const canBulkImport = planAtLeast(plan, "basic");
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Client | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);
  const [gstLooking, setGstLooking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientStats, setClientStats] = useState<Record<string, { invoiced: number; outstanding: number }>>({});
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; desc: string; action: () => void } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchClients = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false });
    setClients(data || []);
  }, [supabase, ownerId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    fetch("/api/invoices")
      .then(r => r.json())
      .then(({ invoices }) => {
        if (!invoices) return;
        const stats: Record<string, { invoiced: number; outstanding: number }> = {};
        for (const inv of invoices) {
          if (inv.invoice_type === "proforma") continue;
          const key = (inv.customer_email || inv.customer_name || "").toLowerCase();
          if (!key) continue;
          if (!stats[key]) stats[key] = { invoiced: 0, outstanding: 0 };
          stats[key].invoiced += inv.total;
          if (inv.status !== "paid") stats[key].outstanding += inv.total - (inv.amount_paid ?? 0);
        }
        setClientStats(stats);
      });
  }, []);

  function openEdit(c: Client) {
    setEditing(c);
    setEditForm({ name: c.name, email: c.email, phone: c.phone || "", company: c.company || "", address: c.address || "", gstin: c.gstin || "" });
    setEditOpen(true);
  }

  async function lookupGST(gstin: string, setF: (v: typeof emptyForm) => void, currentForm: typeof emptyForm) {
    if (!GSTIN_RE.test(gstin.toUpperCase())) return;
    setGstLooking(true);
    try {
      const res = await fetch(`/api/gst-lookup?gstin=${encodeURIComponent(gstin.toUpperCase())}`);
      const data = await res.json();
      if (!res.ok || data.error) { toast.error(data.error || "GSTIN not found"); return; }
      setF({
        ...currentForm,
        gstin: gstin.toUpperCase(),
        company: currentForm.company || data.tradeName || data.legalName || "",
        name: currentForm.name || data.legalName || "",
        address: currentForm.address || data.address || "",
      });
      toast.success("Business details fetched from GST portal");
    } catch {
      toast.error("GST lookup failed. Please fill details manually.");
    } finally {
      setGstLooking(false);
    }
  }

  async function deleteClient(id: string, name: string, email: string) {
    if (!ownerId) return;
    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .or(`customer_name.eq.${name},customer_email.eq.${email}`);
    const desc = count && count > 0
      ? `This client has ${count} invoice(s) linked. Deleting the client won't delete those invoices. Continue?`
      : "Delete this client? This cannot be undone.";
    setPendingConfirm({
      title: "Delete Client",
      desc,
      action: async () => {
        const { error } = await supabase.from("clients").delete().eq("id", id);
        if (error) toast.error("Failed to delete client");
        else { toast.success("Client deleted"); fetchClients(); }
      }
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (plan === "free" && clients.length >= 3) {
      toast.error("Free plan limit: max 3 clients. Upgrade to add unlimited clients.");
      return;
    }
    setSaving(true);
    if (!ownerId) return;
    const { error } = await supabase.from("clients").insert({
      user_id: ownerId,
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      company: form.company || null,
      address: form.address || null,
      gstin: form.gstin || null,
    });
    if (error) { toast.error("Failed to add client"); }
    else { toast.success("Client added!"); setOpen(false); setForm(emptyForm); fetchClients(); }
    setSaving(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("clients").update({
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone || null,
      company: editForm.company || null,
      address: editForm.address || null,
      gstin: editForm.gstin || null,
    }).eq("id", editing.id);
    if (error) { toast.error("Failed to update client"); }
    else { toast.success("Client updated!"); setEditOpen(false); setEditing(null); fetchClients(); }
    setSaving(false);
  }

  function exportCSV() {
    const rows = [["Name", "Email", "Phone", "Company", "Address", "GSTIN"]];
    for (const c of clients) rows.push([c.name, c.email, c.phone || "", c.company || "", c.address || "", c.gstin || ""]);
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "clients.csv"; a.click();
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
    if (!canBulkImport) { toast.error("Bulk CSV import requires Basic plan or higher."); return; }
    setImporting(true);
    try {
      if (!ownerId) return;

      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("CSV file is empty");

      const header = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      const idx = (name: string) => header.indexOf(name);

      const toInsert = dataRows
        .map(r => ({
          user_id: ownerId,
          name: r[idx("name")]?.trim() || "",
          email: r[idx("email")]?.trim() || "",
          phone: r[idx("phone")]?.trim() || null,
          company: r[idx("company")]?.trim() || null,
          address: r[idx("address")]?.trim() || null,
        }))
        .filter(c => c.name && c.email);

      const failed = dataRows.length - toInsert.length;
      if (!toInsert.length) throw new Error("No valid rows found (each needs Name and Email)");

      const { error, count } = await supabase.from("clients").insert(toInsert, { count: "exact" });
      if (error) throw new Error(error.message);

      toast.success(`Imported ${count ?? toInsert.length} client${(count ?? toInsert.length) === 1 ? "" : "s"}${failed ? `, ${failed} skipped` : ""}`);
      fetchClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const ClientForm = ({ f, setF, onSubmit, submitLabel }: {
    f: typeof emptyForm;
    setF: (v: typeof emptyForm) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* GSTIN with autofill — put at top so it can pre-fill other fields */}
      <div className="space-y-2">
        <Label>GSTIN</Label>
        <div className="flex gap-2">
          <Input
            placeholder="22AAAAA0000A1Z5"
            value={f.gstin}
            maxLength={15}
            className="uppercase"
            onChange={e => setF({ ...f, gstin: e.target.value.toUpperCase() })}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 dark:border-gray-600 dark:text-gray-300"
            disabled={gstLooking || !GSTIN_RE.test(f.gstin)}
            onClick={() => lookupGST(f.gstin, setF, f)}
          >
            {gstLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
          </Button>
        </div>
        {f.gstin.length > 0 && f.gstin.length < 15 && (
          <p className="text-xs text-gray-400">GSTIN must be 15 characters</p>
        )}
        {f.gstin.length === 15 && !GSTIN_RE.test(f.gstin) && (
          <p className="text-xs text-red-500">Invalid GSTIN format</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Full Name *</Label>
        <Input placeholder="Rahul Sharma" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>Email *</Label>
        <Input type="email" placeholder="rahul@company.com" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input placeholder="+91 98765 43210" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Company</Label>
        <Input placeholder="ABC Technologies" value={f.company} onChange={e => setF({ ...f, company: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input placeholder="Delhi, India" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
      </div>
      <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
        {saving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage your client relationships
            {plan === "free" && <span className="ml-2 text-orange-500 font-medium">{clients.length}/3 used</span>}
          </p>
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
            onClick={() => canBulkImport ? fileInputRef.current?.click() : toast.error("Bulk CSV import requires Basic plan or higher.")}
            disabled={importing}
            className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium px-3 h-8 rounded-lg transition-colors disabled:opacity-50"
            title={canBulkImport ? "Import clients from CSV" : "Requires Basic plan or higher"}
          >
            <Upload size={15} /> {importing ? "Importing..." : "Import CSV"} {!canBulkImport && <span className="text-orange-500 font-normal">(Basic+)</span>}
          </button>
          {clients.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium px-3 h-8 rounded-lg transition-colors">
              <Download size={15} /> Export CSV
            </button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
              <Plus size={16} /> Add Client
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <ClientForm f={form} setF={setForm} onSubmit={handleAdd} submitLabel="Add Client" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={v => { setEditOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <ClientForm f={editForm} setF={setEditForm} onSubmit={handleEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {!isPro && clients.length > 0 && <AdBanner format="horizontal" className="mb-6" />}

      {clients.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No clients yet</p>
          <p className="text-sm">Add your first client to get started</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 relative">
                  <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                    {c.company && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 size={11} /> {c.company}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <Mail size={11} /> {c.email}
                    </p>
                    {c.phone && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {c.phone}
                      </p>
                    )}
                    {c.address && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {c.address}
                      </p>
                    )}
                    {c.gstin && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">GSTIN: {c.gstin}</p>
                    )}
                    {(() => {
                      const key = (c.email || c.name || "").toLowerCase();
                      const s = clientStats[key];
                      if (!s || s.invoiced === 0) return null;
                      return (
                        <div className="flex gap-3 mt-2 pt-2 border-t dark:border-gray-700">
                          <span className="text-xs text-gray-500 dark:text-gray-400">₹{Math.round(s.invoiced).toLocaleString("en-IN")} invoiced</span>
                          {s.outstanding > 0 && <span className="text-xs text-orange-500 font-medium">₹{Math.round(s.outstanding).toLocaleString("en-IN")} due</span>}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="absolute top-0 right-0 flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: c.id }) });
                        const data = await res.json();
                        if (data.token) {
                          const url = `${window.location.origin}/portal/${data.token}`;
                          await navigator.clipboard.writeText(url);
                          toast.success("Portal link copied!");
                        } else toast.error("Failed to generate link");
                      }}
                      className="text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      title="Copy client portal link"
                    >
                      <Link2 size={14} />
                    </button>
                    {c.email && (
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: c.id, sendEmail: true }) });
                          const data = await res.json();
                          if (data.token) toast.success(`Portal link emailed to ${c.email}!`);
                          else toast.error("Failed — check your Gmail SMTP in Settings");
                        }}
                        className="text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                        title="Email portal link to client"
                      >
                        <Send size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(c)}
                      className="text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                      title="Edit client"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteClient(c.id, c.name, c.email)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isPro && clients.length > 0 && <AdBanner format="rectangle" className="mt-8 max-w-sm mx-auto" />}
      {pendingConfirm && (
        <ConfirmDialog open title={pendingConfirm.title} description={pendingConfirm.desc} onConfirm={() => { pendingConfirm.action(); setPendingConfirm(null); }} onCancel={() => setPendingConfirm(null)} />
      )}
    </div>
  );
}
