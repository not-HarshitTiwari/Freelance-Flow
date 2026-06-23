"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });

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
    });

    if (error) {
      toast.error("Failed to add client");
    } else {
      toast.success("Client added!");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", company: "" });
      fetchClients();
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your client relationships</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
              <Plus size={16} /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="rahul@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  placeholder="ABC Technologies"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={saving}>
                {saving ? "Adding..." : "Add Client"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No clients yet</p>
          <p className="text-sm">Add your first client to get started</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    {c.company && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Building2 size={11} /> {c.company}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Mail size={11} /> {c.email}
                    </p>
                    {c.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {c.phone}
                      </p>
                    )}
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
