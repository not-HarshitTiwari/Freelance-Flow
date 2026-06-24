"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, FileText, Copy, Lock, Trash2, Pencil, Send, Check } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import { RewardedAdModal } from "@/components/ads/RewardedAdModal";
import { usePlan } from "@/lib/plan-context";
import { toast } from "sonner";

type Proposal = {
  id: string;
  title: string;
  content: string;
  status: string;
  amount: number | null;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  company: string | null;
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  accepted: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [sendTarget, setSendTarget] = useState<Proposal | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [sending, setSending] = useState(false);
  const planCtx = usePlan();
  const [isPro, setIsPro] = useState(false);
  const [rewardedOpen, setRewardedOpen] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    projectDescription: "",
    budget: "",
    timeline: "",
  });

  const fetchProposals = useCallback(async () => {
    const res = await fetch("/api/proposals");
    const data = await res.json();
    setProposals(data.proposals || []);
  }, []);

  useEffect(() => {
    fetchProposals();
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: profile }, { data: clientData }] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).single(),
        supabase.from("clients").select("id, name, email, company").eq("user_id", user.id).order("name"),
      ]);
      setIsPro(profile?.plan === "pro" || planCtx === "pro");
      setClients(clientData || []);
    });
  }, [fetchProposals]);

  function pickClient(id: string) {
    setSelectedClientId(id);
    if (!id) { setForm(f => ({ ...f, clientName: "", clientEmail: "", clientCompany: "" })); return; }
    const c = clients.find(cl => cl.id === id);
    if (c) setForm(f => ({ ...f, clientName: c.name, clientEmail: c.email, clientCompany: c.company || "" }));
  }

  async function deleteProposal(id: string) {
    if (!confirm("Delete this proposal? This cannot be undone.")) return;
    await fetch("/api/proposals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Proposal deleted");
    fetchProposals();
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Proposal generated!");
      setOpen(false);
      setForm({ clientName: "", clientEmail: "", clientCompany: "", projectDescription: "", budget: "", timeline: "" });
      setSelectedClientId("");
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate proposal");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    const res = await fetch("/api/proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, content: editContent }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); }
    else {
      toast.success("Proposal saved!");
      setEditing(null);
      fetchProposals();
      // Update selected view if open
      if (selected?.id === editing.id) setSelected({ ...selected, content: editContent });
    }
    setEditSaving(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sendTarget) return;
    setSending(true);
    try {
      const res = await fetch("/api/proposals/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: sendTarget.id, toEmail: sendEmail, toName: sendName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Proposal sent to ${sendEmail}!`);
      setSendTarget(null);
      setSendEmail(""); setSendName("");
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function generateAfterAd() {
    setPendingGenerate(false);
    setGenerating(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Proposal generated!");
      setOpen(false);
      setForm({ clientName: "", clientEmail: "", clientCompany: "", projectDescription: "", budget: "", timeline: "" });
      setSelectedClientId("");
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate proposal");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <RewardedAdModal
        open={rewardedOpen}
        title="Generate Proposal"
        description="Watch a short ad to generate one AI proposal for free"
        onRewarded={generateAfterAd}
        onClose={() => { setRewardedOpen(false); setPendingGenerate(false); }}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proposals</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {isPro ? "Generate AI-powered proposals in seconds" : "Watch an ad to generate proposals for free"}
          </p>
        </div>
        {isPro ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Sparkles size={16} /> Generate Proposal
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate AI Proposal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Client picker */}
              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Pick a saved client (optional)</Label>
                  <select
                    value={selectedClientId}
                    onChange={e => pickClient(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none"
                  >
                    <option value="">— Select client —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input
                    placeholder="Rahul Sharma"
                    value={form.clientName}
                    onChange={e => setForm({ ...form, clientName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input
                    type="email"
                    placeholder="rahul@company.com"
                    value={form.clientEmail}
                    onChange={e => setForm({ ...form, clientEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Client Company</Label>
                <Input
                  placeholder="ABC Technologies"
                  value={form.clientCompany}
                  onChange={e => setForm({ ...form, clientCompany: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Project Description *</Label>
                <Textarea
                  placeholder="Build an e-commerce website with payment integration..."
                  value={form.projectDescription}
                  onChange={e => setForm({ ...form, projectDescription: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Budget (₹)</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={form.budget}
                    onChange={e => setForm({ ...form, budget: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeline</Label>
                  <Input
                    placeholder="4 weeks"
                    value={form.timeline}
                    onChange={e => setForm({ ...form, timeline: e.target.value })}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                disabled={generating}
              >
                {generating ? (
                  <span className="flex items-center gap-2"><Sparkles size={16} className="animate-spin" /> Generating...</span>
                ) : (
                  <span className="flex items-center gap-2"><Sparkles size={16} /> Generate with AI</span>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        ) : (
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="inline-flex items-center gap-2 border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 text-sm font-medium px-3 h-8 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                <Sparkles size={16} /> Watch Ad &amp; Generate
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Generate AI Proposal (Free)</DialogTitle></DialogHeader>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Fill in details, then watch a short ad to generate.</p>
                <form onSubmit={e => { e.preventDefault(); setPendingGenerate(true); setOpen(false); setRewardedOpen(true); }} className="space-y-4">
                  {clients.length > 0 && (
                    <div className="space-y-2">
                      <Label>Pick a saved client (optional)</Label>
                      <select value={selectedClientId} onChange={e => pickClient(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-900 dark:text-gray-100 px-2.5 text-sm outline-none">
                        <option value="">— Select client —</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Client Name *</Label><Input placeholder="Rahul Sharma" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Client Email</Label><Input type="email" placeholder="rahul@co.com" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Client Company</Label><Input placeholder="ABC Tech" value={form.clientCompany} onChange={e => setForm({ ...form, clientCompany: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Project Description *</Label><Textarea placeholder="Build an e-commerce website..." value={form.projectDescription} onChange={e => setForm({ ...form, projectDescription: e.target.value })} rows={3} required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Budget (₹)</Label><Input type="number" placeholder="50000" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Timeline</Label><Input placeholder="4 weeks" value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"><Sparkles size={16} /> Continue to Ad</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Link href="/dashboard/upgrade">
              <Button className="bg-violet-600 hover:bg-violet-700 text-white text-sm h-8 gap-1.5">
                <Sparkles size={14} /> Upgrade to Pro
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Horizontal ad for free users */}
      {!isPro && <AdBanner format="horizontal" className="mb-6" />}

      {proposals.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No proposals yet</p>
          <p className="text-sm">
            {isPro ? "Click \"Generate Proposal\" to create your first one" : "Watch an ad to generate your first proposal"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p, i) => (
            <div key={p.id}>
              {!isPro && i > 0 && i % 3 === 0 && (
                <AdBanner format="rectangle" className="my-3" />
              )}
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelected(p)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(p.created_at).toLocaleDateString("en-IN")}
                      {p.amount && ` • ₹${p.amount.toLocaleString("en-IN")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Badge className={statusColors[p.status] || ""}>{p.status}</Badge>
                    <button
                      onClick={() => { setEditing(p); setEditContent(p.content); }}
                      className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"
                      title="Edit proposal"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => { setSendTarget(p); setSendEmail(""); setSendName(""); }}
                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Send via email"
                    >
                      <Send size={15} />
                    </button>
                    <button
                      onClick={() => deleteProposal(p.id)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete proposal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* View Proposal Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
            {selected?.content}
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => {
                navigator.clipboard.writeText(selected?.content || "");
                toast.success("Copied to clipboard!");
              }}
            >
              <Copy size={14} /> Copy
            </Button>
            <Button
              variant="outline"
              className="gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => {
                if (selected) { setEditing(selected); setEditContent(selected.content); setSelected(null); }
              }}
            >
              <Pencil size={14} /> Edit
            </Button>
            <Button
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                if (selected) { setSendTarget(selected); setSelected(null); }
              }}
            >
              <Send size={14} /> Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Proposal Dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit — {editing?.title}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={20}
            className="font-mono text-sm dark:bg-gray-900 dark:text-gray-100 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              onClick={saveEdit}
              disabled={editSaving}
            >
              <Check size={14} /> {editSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" className="dark:border-gray-600 dark:text-gray-300" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={!!sendTarget} onOpenChange={v => { if (!v) setSendTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Proposal via Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            Sends <span className="font-medium text-gray-700 dark:text-gray-300">{sendTarget?.title}</span> using your Gmail SMTP from Settings.
          </p>
          <form onSubmit={handleSend} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input
                placeholder="Rahul Sharma"
                value={sendName}
                onChange={e => setSendName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient Email *</Label>
              <Input
                type="email"
                placeholder="rahul@company.com"
                value={sendEmail}
                onChange={e => setSendEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
              disabled={sending}
            >
              <Send size={14} /> {sending ? "Sending..." : "Send Proposal"}
            </Button>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              No SMTP set up?{" "}
              <Link href="/dashboard/settings" className="text-violet-600 dark:text-violet-400 underline">
                Configure in Settings
              </Link>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
