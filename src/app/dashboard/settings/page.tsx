"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Upload, X, Pen, Trash2, Lock, UserPlus, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import { TwoFactorSettings } from "@/components/dashboard/TwoFactorSettings";

type PdfTemplate = "classic" | "minimal" | "bold";
const PDF_TEMPLATES: { id: PdfTemplate; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
];
const ACCENT_COLORS = ["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#db2777","#000000"];
const CURRENCIES: Record<string, string> = {
  INR: "INR — Indian Rupee", USD: "USD — US Dollar", EUR: "EUR — Euro",
  GBP: "GBP — British Pound", AED: "AED — UAE Dirham", SGD: "SGD — Singapore Dollar",
};

const emptyForm = {
  full_name: "", business_name: "", business_address: "",
  email: "", phone: "", gstin: "",
  upi_id: "",
  bank_account_name: "", bank_account_number: "", bank_ifsc: "", bank_name: "",
  smtp_email: "", smtp_password: "",
};

const SEPARATORS = [{ val: "-", label: "Hyphen (INV-2026-0001)" }, { val: "/", label: "Slash (INV/2026/0001)" }, { val: ".", label: "Dot (INV.2026.0001)" }];

type InvNumFmt = {
  inv_prefix: string;
  inv_suffix: string;
  inv_separator: string;
  inv_include_year: boolean;
  inv_include_month: boolean;
  inv_include_date: boolean;
  inv_seq_digits: number;
  inv_next_seq: number;
};

function buildPreview(fmt: InvNumFmt): string {
  const now = new Date();
  const parts: string[] = [];
  if (fmt.inv_prefix) parts.push(fmt.inv_prefix);
  if (fmt.inv_include_year) parts.push(now.getFullYear().toString());
  if (fmt.inv_include_month) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  if (fmt.inv_include_date) parts.push(String(now.getDate()).padStart(2, "0"));
  parts.push(String(fmt.inv_next_seq).padStart(fmt.inv_seq_digits, "0"));
  if (fmt.inv_suffix) parts.push(fmt.inv_suffix);
  return parts.join(fmt.inv_separator || "-");
}

type TeamMember = { id: string; member_email: string; member_id: string | null; status: string; role: string; invited_at: string; accepted_at: string | null };

export default function SettingsPage() {
  const plan = usePlan();
  const canSetCadence = planAtLeast(plan, "pro");
  const canManageTeam = planAtLeast(plan, "advanced");
  const [workspaceRole, setWorkspaceRole] = useState<string>("owner");
  const canEditSettings = workspaceRole === "owner" || workspaceRole === "admin";
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("classic");
  const [pdfColor, setPdfColor] = useState<string>("#7c3aed");
  const [currency, setCurrency] = useState("INR");
  const [defaultDueDays, setDefaultDueDays] = useState(0);
  const [defaultNotes, setDefaultNotes] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [reminderCadence, setReminderCadence] = useState(3);
  const [savingCadence, setSavingCadence] = useState(false);

  // Invoice number format
  const [invFmt, setInvFmt] = useState<InvNumFmt>({
    inv_prefix: "INV", inv_suffix: "", inv_separator: "-",
    inv_include_year: true, inv_include_month: false, inv_include_date: false,
    inv_seq_digits: 4, inv_next_seq: 1,
  });
  const [savingInvFmt, setSavingInvFmt] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  async function testSmtpEmail() {
    setTestingSmtp(true);
    try {
      const res = await fetch("/api/test-email", { method: "POST" });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else toast.success(`Test email sent to ${data.to}`);
    } catch { toast.error("Test failed"); }
    finally { setTestingSmtp(false); }
  }

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviting, setInviting] = useState(false);

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Signature state
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [drawing, setDrawing] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setPdfTemplate((localStorage.getItem("inv_template") as PdfTemplate) || "classic");
    setPdfColor(localStorage.getItem("inv_color") || "#7c3aed");
    setCurrency(localStorage.getItem("inv_currency") || "INR");
    setDefaultDueDays(parseInt(localStorage.getItem("inv_default_due_days") || "0"));
    setDefaultNotes(localStorage.getItem("inv_default_notes") || "");
    setDefaultTerms(localStorage.getItem("inv_default_terms") || "");
    fetch("/api/profile").then(r => r.json()).then(({ profile, role }) => {
      if (role) setWorkspaceRole(role);
      if (profile) {
        setForm({
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
        setLogoUrl(profile.logo_url || null);
        setSignatureUrl(profile.signature_url || null);
        setSignatureName(profile.signature_name || "");
        setReminderCadence(profile.reminder_cadence_days ?? 3);
        setInvFmt({
          inv_prefix: profile.inv_prefix ?? "INV",
          inv_suffix: profile.inv_suffix ?? "",
          inv_separator: profile.inv_separator ?? "-",
          inv_include_year: profile.inv_include_year ?? true,
          inv_include_month: profile.inv_include_month ?? false,
          inv_include_date: profile.inv_include_date ?? false,
          inv_seq_digits: profile.inv_seq_digits ?? 4,
          inv_next_seq: profile.inv_next_seq ?? 1,
        });
      }
    });
  }, []);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(({ members }) => { if (members) setTeamMembers(members); });
  }, []);

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      fetch("/api/team").then(r => r.json()).then(({ members }) => { if (members) setTeamMembers(members); });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send invite"); }
    finally { setInviting(false); }
  }

  async function changeRole(memberId: string, role: string) {
    const previous = teamMembers;
    setTeamMembers(ms => ms.map(m => (m.id === memberId ? { ...m, role } : m)));
    const res = await fetch("/api/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, role }) });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); setTeamMembers(previous); return; }
    toast.success("Role updated");
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this team member?")) return;
    const res = await fetch("/api/team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    toast.success("Member removed");
    setTeamMembers(ms => ms.filter(m => m.id !== memberId));
  }

  // ── Logo upload ───────────────────────────────────────────────
  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
      await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logo_url: publicUrl }) });
      setLogoUrl(publicUrl);
      toast.success("Logo uploaded!");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploadingLogo(false); }
  }

  async function removeLogo() {
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logo_url: null }) });
    setLogoUrl(null);
    toast.success("Logo removed");
  }

  // ── Signature canvas ─────────────────────────────────────────
  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!drawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = "#1e1e2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw() { setDrawing(false); lastPos.current = null; }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }

  const renderTypedSig = useCallback(() => {
    if (sigMode !== "type" || !signatureName || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "italic 32px Georgia, serif";
    ctx.fillStyle = "#1e1e2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(signatureName, canvas.width / 2, canvas.height / 2);
  }, [sigMode, signatureName]);

  useEffect(() => { renderTypedSig(); }, [renderTypedSig]);

  async function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingSig(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      // Convert to blob and upload
      const blob = await (await fetch(dataUrl)).blob();
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.storage.from("logos").upload(`${user.id}/signature.png`, blob, { upsert: true, contentType: "image/png" });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(`${user.id}/signature.png`);
      await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature_url: publicUrl, signature_name: signatureName }) });
      setSignatureUrl(publicUrl);
      toast.success("Signature saved!");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save signature"); }
    finally { setSavingSig(false); }
  }

  async function removeSignature() {
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature_url: null, signature_name: null }) });
    setSignatureUrl(null); setSignatureName(""); clearCanvas();
    toast.success("Signature removed");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.error) toast.error(data.error); else toast.success("Settings saved!");
    setSaving(false);
  }

  async function saveInvFmt() {
    setSavingInvFmt(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invFmt) });
    const data = await res.json();
    if (data.error) toast.error(data.error); else toast.success("Invoice numbering saved!");
    setSavingInvFmt(false);
  }

  async function saveReminderCadence() {
    if (!canSetCadence) return;
    setSavingCadence(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminder_cadence_days: reminderCadence }) });
    const data = await res.json();
    if (data.error) toast.error(data.error); else toast.success("Reminder cadence saved!");
    setSavingCadence(false);
  }

  const f = form;
  const s = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...f, [k]: e.target.value });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Settings</h1>

      {!canEditSettings && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          Your role ({workspaceRole}) has read-only access to workspace settings. Ask the owner or an admin to make changes.
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <fieldset disabled={!canEditSettings} className="space-y-5">

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

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">Business Logo</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">Appears in the top-left of invoice PDFs. PNG or JPG, max 2MB.</p>
          </CardHeader>
          <CardContent>
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 rounded-lg border dark:border-gray-700 overflow-hidden bg-white flex items-center justify-center p-2">
                  <Image src={logoUrl} alt="Logo" width={80} height={48} className="object-contain max-h-12" unoptimized />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={removeLogo} className="gap-1.5 text-red-500 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={13} /> Remove
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-violet-400 transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                {uploadingLogo ? (
                  <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={20} className="text-gray-400 mb-1" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload logo</p>
                  </>
                )}
              </label>
            )}
          </CardContent>
        </Card>

        {/* Digital Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">Digital Signature</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">Embedded at the bottom of invoice PDFs as your authorization.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatureUrl && (
              <div className="flex items-center gap-4">
                <div className="border dark:border-gray-700 rounded-lg bg-white p-2">
                  <Image src={signatureUrl} alt="Signature" width={160} height={60} className="object-contain max-h-14" unoptimized />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={removeSignature} className="gap-1.5 text-red-500 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={13} /> Remove
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              {(["draw", "type"] as const).map(m => (
                <button key={m} type="button" onClick={() => { setSigMode(m); clearCanvas(); if (m === "type") setTimeout(renderTypedSig, 50); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${sigMode === m ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
                  {m === "draw" ? <><Pen size={11} className="inline mr-1" />Draw</> : "Type Name"}
                </button>
              ))}
            </div>
            {sigMode === "type" && (
              <Input value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="Your Full Name" className="font-serif italic" />
            )}
            <div className="relative border dark:border-gray-700 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef} width={480} height={120}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
              />
              <button type="button" onClick={clearCanvas} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
              {sigMode === "draw" && <p className="absolute bottom-2 left-3 text-xs text-gray-300 pointer-events-none">Draw your signature above</p>}
            </div>
            <Button type="button" onClick={saveSignature} disabled={savingSig} className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
              {savingSig ? "Saving…" : "Save Signature"}
            </Button>
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
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 underline">Get App Password</a>{" "}
              (requires 2FA on Google account).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Gmail Address</Label><Input type="email" value={f.smtp_email} onChange={s("smtp_email")} placeholder="yourname@gmail.com" /></div>
            <div className="space-y-2">
              <Label>App Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={f.smtp_password} onChange={s("smtp_password")} placeholder="xxxx xxxx xxxx xxxx" className="pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={testSmtpEmail} disabled={testingSmtp || !f.smtp_email || !f.smtp_password} className="w-full dark:border-gray-600 dark:text-gray-300">
              {testingSmtp ? "Sending test…" : "Send Test Email"}
            </Button>
          </CardContent>
        </Card>

        {/* Invoice PDF Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">Invoice PDF Defaults</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">Default template, color, and currency used when downloading invoices.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="flex gap-2">
                {PDF_TEMPLATES.map(t => (
                  <button key={t.id} type="button" onClick={() => { setPdfTemplate(t.id); localStorage.setItem("inv_template", t.id); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${pdfTemplate === t.id ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-violet-400"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <select value={currency} onChange={e => { setCurrency(e.target.value); localStorage.setItem("inv_currency", e.target.value); }}
                className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-3 text-sm outline-none">
                {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => { setPdfColor(c); localStorage.setItem("inv_color", c); }}
                    className="w-8 h-8 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: pdfColor === c ? "#000" : "transparent" }} />
                ))}
                <label className="relative w-8 h-8 rounded-full border-2 border-gray-300 overflow-hidden cursor-pointer" title="Custom color">
                  <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    value={pdfColor} onChange={e => { setPdfColor(e.target.value); localStorage.setItem("inv_color", e.target.value); }} />
                  <span className="flex items-center justify-center w-full h-full text-xs text-gray-400">+</span>
                </label>
                <button type="button" title="No color" onClick={() => { setPdfColor("none"); localStorage.setItem("inv_color", "none"); }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${pdfColor === "none" ? "border-black dark:border-white" : "border-gray-300"}`}
                  style={{ background: "repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 6px)" }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Used as the header/highlight color in the PDF.</p>
            </div>
          </CardContent>
        </Card>

        {/* New Invoice Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base dark:text-white">New Invoice Defaults</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pre-filled values when creating a new invoice.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Due Days</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={0} max={365} value={defaultDueDays} onChange={e => { const v = Math.max(0, parseInt(e.target.value) || 0); setDefaultDueDays(v); localStorage.setItem("inv_default_due_days", String(v)); }} className="w-28 h-9" />
                <span className="text-sm text-gray-400">days after invoice date (0 = no default)</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Notes</Label>
              <Textarea value={defaultNotes} onChange={e => { setDefaultNotes(e.target.value); localStorage.setItem("inv_default_notes", e.target.value); }} rows={2} placeholder="Thank you for your business!" />
            </div>
            <div className="space-y-2">
              <Label>Default Terms</Label>
              <Textarea value={defaultTerms} onChange={e => { setDefaultTerms(e.target.value); localStorage.setItem("inv_default_terms", e.target.value); }} rows={2} placeholder="Payment due within 15 days of invoice date." />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        </fieldset>
      </form>

      {/* Invoice Number Format — outside the main form so it has its own save */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base dark:text-white">Invoice Number Format</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customize how invoice numbers are generated. Preview updates live.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Live preview */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg px-4 py-3">
            <p className="text-xs text-violet-500 dark:text-violet-400 font-semibold uppercase mb-1">Next Invoice Number Preview</p>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300 font-mono">{buildPreview(invFmt)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prefix (optional)</Label>
              <Input value={invFmt.inv_prefix} onChange={e => setInvFmt(f => ({ ...f, inv_prefix: e.target.value }))} placeholder="e.g. INV or leave blank" />
            </div>
            <div className="space-y-2">
              <Label>Suffix (optional)</Label>
              <Input value={invFmt.inv_suffix} onChange={e => setInvFmt(f => ({ ...f, inv_suffix: e.target.value }))} placeholder="e.g. IND or leave blank" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Separator</Label>
            <div className="flex flex-wrap gap-2">
              {SEPARATORS.map(s => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => setInvFmt(f => ({ ...f, inv_separator: s.val }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${invFmt.inv_separator === s.val ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Include in Number</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "inv_include_year" as const, label: "Year" },
                { key: "inv_include_month" as const, label: "Month" },
                { key: "inv_include_date" as const, label: "Date" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInvFmt(f => ({ ...f, [key]: !f[key] }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${invFmt[key] ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Number Digits</Label>
              <select
                value={invFmt.inv_seq_digits}
                onChange={e => setInvFmt(f => ({ ...f, inv_seq_digits: parseInt(e.target.value) }))}
                className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-3 text-sm outline-none"
              >
                <option value={3}>3 digits (001)</option>
                <option value={4}>4 digits (0001)</option>
                <option value={5}>5 digits (00001)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Next Sequence Number</Label>
              <Input
                type="number"
                min={1}
                value={invFmt.inv_next_seq}
                onChange={e => setInvFmt(f => ({ ...f, inv_next_seq: parseInt(e.target.value) || 1 }))}
                placeholder="1"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400">⚠ Reducing this number may generate duplicate invoice numbers.</p>
            </div>
          </div>

          <Button type="button" onClick={saveInvFmt} disabled={savingInvFmt || !canEditSettings} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {savingInvFmt ? "Saving..." : "Save Invoice Numbering"}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Reminder Cadence — Pro+ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base dark:text-white flex items-center gap-2">
            Payment Reminder Cadence
            {!canSetCadence && <Lock className="h-3.5 w-3.5 text-gray-400" />}
          </CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            How often to re-send overdue payment reminder emails to clients.
            {!canSetCadence && " Upgrade to Pro or higher to customize this."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Remind every (days)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={reminderCadence}
              disabled={!canSetCadence}
              onChange={e => setReminderCadence(Math.max(1, parseInt(e.target.value) || 1))}
              placeholder="3"
            />
          </div>
          <Button
            type="button"
            onClick={saveReminderCadence}
            disabled={!canSetCadence || savingCadence || !canEditSettings}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
          >
            {savingCadence ? "Saving..." : canSetCadence ? "Save Reminder Cadence" : "Pro plan required"}
          </Button>
        </CardContent>
      </Card>

      <TwoFactorSettings />

      {/* Team Members — Advanced+ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base dark:text-white flex items-center gap-2">
            Team Members
            {!canManageTeam && <Lock className="h-3.5 w-3.5 text-gray-400" />}
          </CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Invite collaborators to access your workspace.
            {!canManageTeam && " Upgrade to Advanced to manage team members."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManageTeam ? (
            <>
              <form onSubmit={inviteMember} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  disabled={inviting}
                  className="flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  disabled={inviting}
                  className="h-9 rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none shrink-0"
                >
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="bg-violet-600 hover:bg-violet-700 text-white shrink-0">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  {inviting ? "Sending…" : "Invite"}
                </Button>
              </form>
              <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                Admin: full access. Accountant: everyday work, no team/settings. Viewer: read-only everywhere.
              </p>
              {teamMembers.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">No team members yet. Invite someone above.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {teamMembers.map(m => (
                    <li key={m.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.member_email}</p>
                        <p className="text-xs text-gray-400 capitalize">{m.status}</p>
                      </div>
                      <select
                        value={m.role}
                        onChange={e => changeRole(m.id, e.target.value)}
                        className="h-8 rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2 text-xs outline-none shrink-0"
                      >
                        <option value="admin">Admin</option>
                        <option value="accountant">Accountant</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                        onClick={() => removeMember(m.id)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Available on the Advanced plan.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
