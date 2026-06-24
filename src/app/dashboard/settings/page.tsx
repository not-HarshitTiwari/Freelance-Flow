"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", business_name: "", business_address: "",
    email: "", phone: "", gstin: "",
  });

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(({ profile }) => {
      if (profile) setForm({
        full_name: profile.full_name || "",
        business_name: profile.business_name || "",
        business_address: profile.business_address || "",
        email: profile.email || "",
        phone: profile.phone || "",
        gstin: profile.gstin || "",
      });
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else toast.success("Profile saved!");
    setSaving(false);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Business Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Business Info</CardTitle>
          <p className="text-sm text-gray-500">This appears on all your invoices as seller details.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Rahul Sharma" />
              </div>
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="Markwings" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Business Address</Label>
              <Input value={form.business_address} onChange={e => setForm({ ...form, business_address: e.target.value })} placeholder="Mumbai, Maharashtra, India" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hello@markwings.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>GSTIN (optional)</Label>
              <Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
            </div>
            <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
