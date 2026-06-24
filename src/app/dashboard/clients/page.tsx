"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Mail, Phone, Building2, MapPin, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  created_at: string;
};

const emptyForm = { name: "", email: "", phone: "", company: "", address: "" };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Client | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);

  const supabase = createClient();

  const fetchClients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setClients(data || []);
  }, [supabase]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  function openEdit(c: Client) {
    setEditing(c);
    setEditForm({ name: c.name, email: c.email, phone: c.phone || "", company: c.company || "", address: c.address || "" });
    setEditOpen(true);
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client? This cannot be undone.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error("Failed to delete client");
    else { toast.success("Client deleted"); fetchClients(); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      company: form.company || null,
      address: form.address || null,
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
    }).eq("id", editing.id);
    if (error) { toast.error("Failed to update client"); }
    else { toast.success("Client updated!"); setEditOpen(false); setEditing(null); fetchClients(); }
    setSaving(false);
  }

  const ClientForm = ({ f, setF, onSubmit, submitLabel }: {
    f: typeof emptyForm;
    setF: (v: typeof emptyForm) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
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
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your client relationships</p>
        </div>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={v => { setEditOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <ClientForm f={editForm} setF={setEditForm} onSubmit={handleEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

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
                  </div>
                  <div className="absolute top-0 right-0 flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                      title="Edit client"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteClient(c.id)}
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
    </div>
  );
}
