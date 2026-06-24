"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const emptyForm = {
  full_name: "", business_name: "", business_address: "",
  email: "", phone: "", gstin: "",
  upi_id: "",
  bank_account_name: "", bank_account_number: "", bank_ifsc: "", bank_name: "",
  smtp_email: "", smtp_password: "",
};

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(({ profile }) => {
      if (profile) setForm({
        full_name: profile.full_name || "",
        business_name: profile.business_name || "",
        business_address: profile.business_address || "",
        email: profile.email || "",
        phone: profile.phone || "",
        gstin: profile.gstin || "",
        upi_id: profile.upi_id || "",
        bank_account_name: profile.bank_account_name || "",
        bank_account_number: profile.bank_account_number || "",
        bank_ifsc: profile.bank_ifsc || "",
        bank_name: profile.bank_name || "",
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

  const f = form;
  const s = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...f, [k]: e.target.value });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Settings</h1>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Business Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">Business Info</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">Appears on invoices and proposals as your details.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={f.full_name} onChange={s("full_name")} placeholder="Rahul Sharma" /></div>
              <div className="space-y-2"><Label>Business Name</Label><Input value={f.business_name} onChange={s("business_name")} placeholder="Markwings" /></div>
            </div>
            <div className="space-y-2"><Label>Business Address</Label><Input value={f.business_address} onChange={s("business_address")} placeholder="Mumbai, Maharashtra, India" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={f.email} onChange={s("email")} placeholder="hello@markwings.com" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={f.phone} onChange={s("phone")} placeholder="+91 98765 43210" /></div>
            </div>
            <div className="space-y-2"><Label>GSTIN (optional)</Label><Input value={f.gstin} onChange={s("gstin")} placeholder="22AAAAA0000A1Z5" /></div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">Payment Details</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">Auto-filled on new invoices when you select UPI or Bank Transfer.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>UPI ID</Label>
              <Input value={f.upi_id} onChange={s("upi_id")} placeholder="yourname@upi" />
            </div>
            <div className="border-t dark:border-gray-700 pt-4 space-y-3">
              <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">Bank Account</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Account Name</Label><Input value={f.bank_account_name} onChange={s("bank_account_name")} placeholder="Rahul Sharma / Markwings" /></div>
                <div className="space-y-2"><Label>Account Number</Label><Input value={f.bank_account_number} onChange={s("bank_account_number")} placeholder="1234567890" /></div>
                <div className="space-y-2"><Label>IFSC Code</Label><Input value={f.bank_ifsc} onChange={s("bank_ifsc")} placeholder="SBIN0001234" /></div>
                <div className="space-y-2"><Label>Bank Name</Label><Input value={f.bank_name} onChange={s("bank_name")} placeholder="State Bank of India" /></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gmail SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">Gmail SMTP</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Used to send invoices and proposals directly from your Gmail.{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 underline">
                Get App Password
              </a>{" "}
              (requires 2FA on Google account).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Gmail Address</Label><Input type="email" value={f.smtp_email} onChange={s("smtp_email")} placeholder="yourname@gmail.com" /></div>
            <div className="space-y-2">
              <Label>App Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={f.smtp_password}
                  onChange={s("smtp_password")}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
