"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileSignature, Trash2, Send, Copy, Eye, Lock, FileDown, Bell } from "lucide-react";
import { toast } from "sonner";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import Link from "next/link";

type Contract = {
  id: string;
  title: string;
  client_name: string | null;
  client_email: string | null;
  body: string;
  status: "draft" | "sent" | "signed";
  sign_token: string;
  client_signature: string | null;
  signed_at: string | null;
  created_at: string;
};

const TEMPLATES = {
  freelance: {
    label: "Freelance Service Agreement",
    body: `FREELANCE SERVICE AGREEMENT

This agreement is between [YOUR_NAME/COMPANY] ("Freelancer") and [CLIENT_NAME] ("Client"), effective [DATE].

SCOPE OF WORK
The Freelancer agrees to provide the following services: [DESCRIBE_SERVICES]

PAYMENT TERMS
Total project fee: ₹[AMOUNT]
Payment schedule: 50% upfront, 50% on delivery.
Invoices are due within 15 days of receipt.

TIMELINE
Project start: [START_DATE]
Expected delivery: [END_DATE]

REVISIONS
Up to [NUMBER] rounds of revisions are included. Additional revisions will be billed at ₹[HOURLY_RATE]/hour.

INTELLECTUAL PROPERTY
Upon full payment, all rights to the final deliverables transfer to the Client. The Freelancer retains the right to display the work in their portfolio.

CONFIDENTIALITY
Both parties agree to keep project details confidential.

TERMINATION
Either party may terminate this agreement with 7 days written notice. Work completed to date will be billed proportionally.

By signing below, both parties agree to the terms of this agreement.

Freelancer: ________________________  Date: ____________
Client: ____________________________  Date: ____________`,
  },
  nda: {
    label: "Non-Disclosure Agreement",
    body: `NON-DISCLOSURE AGREEMENT

This NDA is entered into between [YOUR_NAME/COMPANY] and [CLIENT_NAME] ("Recipient"), effective [DATE].

CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by either party, including business plans, technical data, trade secrets, or client information.

OBLIGATIONS
The Recipient agrees to:
1. Keep all Confidential Information strictly confidential
2. Not disclose it to third parties without prior written consent
3. Use it solely for the purpose of evaluating/executing the project

EXCEPTIONS
This agreement does not apply to information that is: publicly available, independently developed, or legally required to be disclosed.

DURATION
This NDA remains in effect for 2 years from the date of signing.

GOVERNING LAW
This agreement shall be governed by the laws of India.

By signing below, both parties agree to the terms of this NDA.

Disclosing Party: ___________________  Date: ____________
Recipient: _________________________  Date: ____________`,
  },
  retainer: {
    label: "Monthly Retainer Agreement",
    body: `MONTHLY RETAINER AGREEMENT

This agreement is between [YOUR_NAME/COMPANY] ("Service Provider") and [CLIENT_NAME] ("Client"), effective [DATE].

RETAINER SERVICES
The Service Provider will be available for up to [HOURS] hours per month for the following services: [DESCRIBE_SERVICES]

RETAINER FEE
Monthly fee: ₹[AMOUNT], billed on the 1st of each month.
Payment is due within 7 days of invoice.

UNUSED HOURS
Unused hours do not roll over to the following month.

ADDITIONAL WORK
Work beyond the retainer hours will be billed at ₹[HOURLY_RATE]/hour with prior approval.

TERM
This agreement begins on [START_DATE] and renews monthly unless either party provides 30 days written notice of termination.

PRIORITY
Retainer clients receive priority response within 24 business hours.

By signing below, both parties agree to the terms of this retainer agreement.

Service Provider: __________________  Date: ____________
Client: ____________________________  Date: ____________`,
  },
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  signed: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
};

function downloadContractPdf(c: Contract) {
  // dynamic import to keep bundle lean
  import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF();
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(c.title, 14, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Status: ${c.status.toUpperCase()}`, 140, 10);
    if (c.client_name) doc.text(`Client: ${c.client_name}`, 140, 16);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(c.body, 182);
    doc.text(lines, 14, 32);
    if (c.client_signature) {
      const y = doc.internal.pageSize.height - 30;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, 210 - 14, y);
      doc.setFontSize(9);
      doc.setTextColor(22, 163, 74);
      doc.text(`E-Signature: ${c.client_signature}`, 14, y + 8);
      if (c.signed_at) doc.text(`Signed: ${new Date(c.signed_at).toLocaleString("en-IN")}`, 14, y + 15);
    }
    doc.save(`${c.title.replace(/\s+/g, "_")}.pdf`);
  });
}

export default function ContractsPage() {
  const plan = usePlan();
  const canUseContracts = planAtLeast(plan, "basic");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [open, setOpen] = useState(false);
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [form, setForm] = useState({ title: "", client_name: "", client_email: "", body: "" });
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATES | "">("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    const res = await fetch("/api/contracts");
    const data = await res.json();
    setContracts(data.contracts ?? []);
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  function applyTemplate(key: keyof typeof TEMPLATES) {
    setSelectedTemplate(key);
    setForm(f => ({ ...f, title: TEMPLATES[key].label, body: TEMPLATES[key].body }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Contract created!");
      setOpen(false);
      setForm({ title: "", client_name: "", client_email: "", body: "" });
      setSelectedTemplate("");
      fetchContracts();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function sendForSigning(contract: Contract) {
    setSending(contract.id);
    try {
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contract.id, status: "sent" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const link = `${window.location.origin}/sign/${contract.sign_token}`;
      await navigator.clipboard.writeText(link);
      const msg = contract.client_email
        ? `Signing link sent to ${contract.client_email} & copied!`
        : "Status updated to Sent · Signing link copied!";
      toast.success(msg);
      fetchContracts();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSending(null); }
  }

  async function copyLink(contract: Contract) {
    const link = `${window.location.origin}/sign/${contract.sign_token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Signing link copied!");
  }

  async function remindSigning(contract: Contract) {
    setSending(contract.id);
    try {
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contract.id, status: "sent" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const link = `${window.location.origin}/sign/${contract.sign_token}`;
      await navigator.clipboard.writeText(link);
      toast.success(contract.client_email ? `Reminder sent to ${contract.client_email} & link copied!` : "Signing link copied!");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSending(null); }
  }

  async function deleteContract(id: string) {
    if (!confirm("Delete this contract?")) return;
    await fetch("/api/contracts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Deleted");
    fetchContracts();
  }

  if (!canUseContracts) return (
    <div className="text-center py-24">
      <Lock size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Contracts require Basic plan or higher</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Create legally binding agreements and collect e-signatures from clients.</p>
      <Link href="/dashboard/upgrade">
        <Button className="bg-violet-600 hover:bg-violet-700 text-white">Upgrade to Basic — ₹499/mo</Button>
      </Link>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contracts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create agreements and collect e-signatures</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2 h-8 text-sm px-3">
          <Plus size={15} /> New Contract
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <FileSignature size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No contracts yet</p>
          <p className="text-sm">Create your first contract from a template</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{c.title}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    {c.client_name || "No client"} · {new Date(c.created_at).toLocaleDateString("en-IN")}
                    {c.signed_at && ` · Signed ${new Date(c.signed_at).toLocaleDateString("en-IN")}`}
                  </p>
                  {c.client_signature && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Signed by: {c.client_signature}</p>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <Badge className={statusColors[c.status] || ""}>{c.status}</Badge>
                  <button onClick={() => setViewContract(c)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Preview"><Eye size={15} /></button>
                  <button onClick={() => downloadContractPdf(c)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Download PDF"><FileDown size={15} /></button>
                  {c.status === "draft" && (
                    <button onClick={() => sendForSigning(c)} disabled={sending === c.id} className="text-gray-400 hover:text-blue-600" title="Send for signing">
                      <Send size={15} className={sending === c.id ? "animate-pulse" : ""} />
                    </button>
                  )}
                  {c.status === "sent" && !c.client_signature && (
                    <button onClick={() => remindSigning(c)} disabled={sending === c.id} className="text-gray-400 hover:text-amber-500" title="Send signing reminder">
                      <Bell size={15} className={sending === c.id ? "animate-pulse" : ""} />
                    </button>
                  )}
                  {c.status !== "draft" && (
                    <button onClick={() => copyLink(c)} className="text-gray-400 hover:text-violet-600" title="Copy signing link"><Copy size={15} /></button>
                  )}
                  <button onClick={() => deleteContract(c.id)} className="text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setForm({ title: "", client_name: "", client_email: "", body: "" }); setSelectedTemplate(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>

          {/* Template picker */}
          <div className="space-y-2">
            <Label>Start from a template</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(k => (
                <button key={k} type="button" onClick={() => applyTemplate(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedTemplate === k ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-violet-400"}`}>
                  {TEMPLATES[k].label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Freelance Service Agreement" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Client Name</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Acme Corp" /></div>
              <div className="space-y-1.5"><Label>Client Email</Label><Input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="client@acme.com" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Contract Body *</Label>
              <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={14} placeholder="Write or paste your contract here…" required className="font-mono text-xs" />
            </div>
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving}>{saving ? "Creating…" : "Create Contract"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View / Preview Dialog */}
      {viewContract && (
        <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{viewContract.title}</DialogTitle></DialogHeader>
            <div className="flex items-center gap-2 -mt-2 mb-3">
              <Badge className={statusColors[viewContract.status] || ""}>{viewContract.status}</Badge>
              {viewContract.client_name && <span className="text-sm text-gray-500 dark:text-gray-400">{viewContract.client_name}</span>}
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-4 leading-relaxed">{viewContract.body}</pre>
            <Button variant="outline" className="gap-2 dark:border-gray-600 dark:text-gray-300" onClick={() => downloadContractPdf(viewContract)}>
              <FileDown size={14} /> Download PDF
            </Button>
            {viewContract.client_signature && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase mb-1">E-Signature</p>
                <p className="text-green-700 dark:text-green-300 font-medium italic">{viewContract.client_signature}</p>
                <p className="text-xs text-green-500 mt-1">Signed {viewContract.signed_at ? new Date(viewContract.signed_at).toLocaleString("en-IN") : ""}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
