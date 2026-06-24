"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: "", business_name: "", business_address: "",
    email: "", phone: "", gstin: "",
    smtp_email: "", smtp_password: "",
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
        smtp_email: profile.smtp_email || "",
        smtp_password: profile.smtp_password || "",
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
    else toast.success("Settings saved!");
    setSaving(false);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base dark:text-white">Business Info</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">Appears on invoices and proposals as your details.</p>
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

            <div className="border-t dark:border-gray-700 pt-4 space-y-3">
              <div>
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">Gmail SMTP (for sending proposals)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Use your Gmail address and a{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 dark:text-violet-400 underline"
                  >
                    Gmail App Password
                  </a>
                  {" "}(not your regular password). Enable 2FA on your Google account first.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Gmail Address</Label>
                <Input
                  type="email"
                  value={form.smtp_email}
                  onChange={e => setForm({ ...form, smtp_email: e.target.value })}
                  placeholder="yourname@gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Gmail App Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.smtp_password}
                    onChange={e => setForm({ ...form, smtp_password: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Stored securely. Used only to send proposals on your behalf via smtp.gmail.com:587.
                </p>
              </div>
            </div>

            <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
