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
import { Sparkles, FileText, Copy, Lock, Trash2, Pencil, Send, Check, Link2, Search, ThumbsUp, ThumbsDown, FileDown } from "lucide-react";
import { AdBanner } from "@/components/ads/AdBanner";
import { RewardedAdModal } from "@/components/ads/RewardedAdModal";
import { usePlan, planAtLeast } from "@/lib/plan-context";
import { useWorkspace } from "@/lib/workspace-context";
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

function downloadProposalPdf(p: Proposal) {
  import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF();
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(p.title, 14, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(new Date(p.created_at).toLocaleDateString("en-IN"), 170, 10);
    if (p.amount) doc.text(`₹${p.amount.toLocaleString("en-IN")}`, 170, 16);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(p.content, 182);
    doc.text(lines, 14, 32);
    doc.save(`Proposal_${p.title.replace(/\s+/g, "_")}.pdf`);
  });
}

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
  const { ownerId } = useWorkspace();
  const canSendEmail = planAtLeast(planCtx, "pro");
  const [isPro, setIsPro] = useState(false);
  const [rewardedOpen, setRewardedOpen] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [adsRequired, setAdsRequired] = useState(0);
  const [adsWatched, setAdsWatched] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [aiUsage, setAiUsage] = useState<{ used: number; cap: number | null } | null>(null);
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
    if (!ownerId) return;
    fetchProposals();
    const supabase = createClient();
    (async () => {
      const [{ data: profile }, { data: clientData }] = await Promise.all([
        supabase.from("profiles").select("plan, ai_proposals_count, ai_proposals_reset_at").eq("id", ownerId).single(),
        supabase.from("clients").select("id, name, email, company").eq("user_id", ownerId).order("name"),
      ]);
      setIsPro((profile?.plan !== "free" && !!profile?.plan) || planAtLeast(planCtx, "basic"));
      setClients(clientData || []);

      // Mirrors the hard server-side cap in /api/proposals (POST) so users see it before they hit it.
      const MONTHLY_CAP: Record<string, number | null> = { free: 15, basic: 20, pro: 70, advanced: null };
      const plan = profile?.plan || "free";
      const cap = MONTHLY_CAP[plan] ?? 15;
      if (cap === null) {
        setAiUsage({ used: 0, cap: null });
      } else {
        const now = new Date();
        const resetAt = profile?.ai_proposals_reset_at ? new Date(profile.ai_proposals_reset_at) : null;
        const isNewMonth = !resetAt || resetAt.getFullYear() !== now.getFullYear() || resetAt.getMonth() !== now.getMonth();
        setAiUsage({ used: isNewMonth ? 0 : (profile?.ai_proposals_count ?? 0), cap });
      }
    })();
  }, [fetchProposals, ownerId]);

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

  async function doGenerate() {
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
      setAiUsage(u => u && u.cap !== null ? { ...u, used: u.used + 1 } : u);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate proposal");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date();
    const thisMonthCount = proposals.filter(p => {
      const d = new Date(p.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    // Free: always 2 ads
    if (!planAtLeast(planCtx, "basic")) {
      setAdsRequired(2); setAdsWatched(0); setOpen(false); setRewardedOpen(true); return;
    }
    // Basic: 5 free/month, then 2 ads each
    if (!planAtLeast(planCtx, "pro")) {
      if (thisMonthCount >= 5) {
        toast.info(`You've used your 5 free proposals this month. Watch 2 ads to generate more.`);
        setAdsRequired(2); setAdsWatched(0); setOpen(false); setRewardedOpen(true); return;
      }
      await doGenerate(); return;
    }
    // Pro: 50 free/month, then 1 ad each
    if (!planAtLeast(planCtx, "advanced")) {
      if (thisMonthCount >= 50) {
        toast.info(`You've used your 50 free proposals this month. Watch 1 ad to generate more.`);
        setAdsRequired(1); setAdsWatched(0); setOpen(false); setRewardedOpen(true); return;
      }
      await doGenerate(); return;
    }
    // Advanced: unlimited
    await doGenerate();
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

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    toast.success(`Marked as ${status}`);
    fetchProposals();
  }

  async function generateAfterAd() {
    const newWatched = adsWatched + 1;
    setAdsWatched(newWatched);
    setRewardedOpen(false);

    // If more ads still required, re-open the modal for the next ad
    if (newWatched < adsRequired) {
      setTimeout(() => setRewardedOpen(true), 300);
      return;
    }

    // All ads watched — generate the proposal
    setPendingGenerate(false);
    setAdsWatched(0);
    setAdsRequired(0);
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
      setAiUsage(u => u && u.cap !== null ? { ...u, used: u.used + 1 } : u);
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
        description={adsRequired > 1 ? `Watch ad ${adsWatched + 1} of ${adsRequired} to generate this proposal` : "Watch a short ad to generate an AI proposal"}
        onRewarded={generateAfterAd}
        onClose={() => { setRewardedOpen(false); setPendingGenerate(false); setAdsWatched(0); setAdsRequired(0); }}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proposals</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {planAtLeast(planCtx, "advanced") ? "Unlimited AI proposals" : planAtLeast(planCtx, "pro") ? "50 free AI proposals/month, then watch 1 ad" : planAtLeast(planCtx, "basic") ? "5 free AI proposals/month, then watch 2 ads" : "Watch 2 ads per AI proposal"}
          </p>
          {aiUsage && aiUsage.cap !== null && (
            <div className="mt-2 max-w-44">
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                <span>AI proposals this month</span>
                <span className={aiUsage.used >= aiUsage.cap ? "text-red-500 font-medium" : ""}>{aiUsage.used}/{aiUsage.cap}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${aiUsage.used >= aiUsage.cap ? "bg-red-500" : "bg-violet-500"}`}
                  style={{ width: `${Math.min(100, (aiUsage.used / aiUsage.cap) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        {planAtLeast(planCtx, "basic") ? (
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
                <Sparkles size={16} /> Watch 2 Ads &amp; Generate
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Generate AI Proposal (Free)</DialogTitle></DialogHeader>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Fill in details, then watch 2 short ads to generate.</p>
                <form onSubmit={handleGenerate} className="space-y-4">
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
                  <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"><Sparkles size={16} /> Continue to Ads</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Link href="/dashboard/upgrade">
              <Button className="bg-violet-600 hover:bg-violet-700 text-white text-sm h-8 gap-1.5">
                <Sparkles size={14} /> Upgrade
              </Button>
            </Link>
          </div>
        )}
      </div>

      {!isPro && proposals.length > 0 && <AdBanner format="horizontal" className="mb-6" />}

      {proposals.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search proposals…" value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex gap-1.5">
            {["all", "draft", "sent", "accepted", "rejected"].map(s => (
              <button key={s} onClick={() => setStatusF(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${statusF === s ? "bg-violet-600 text-white border-violet-600" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium dark:text-gray-400">No proposals yet</p>
          <p className="text-sm">
            {isPro ? "Click \"Generate Proposal\" to create your first one" : "Watch an ad to generate your first proposal"}
          </p>
        </div>
      ) : (() => {
        const filtered = proposals.filter(p => {
          const q = searchQ.toLowerCase();
          return (!q || p.title.toLowerCase().includes(q)) && (statusF === "all" || p.status === statusF);
        });
        if (filtered.length === 0) return (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <Search size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium dark:text-gray-400">No proposals match your filter</p>
            <button onClick={() => { setSearchQ(""); setStatusF("all"); }} className="text-sm text-violet-500 underline mt-1">Clear filters</button>
          </div>
        );
        return (
        <div className="space-y-3">
          {filtered.map((p, i) => (
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
                    <button onClick={() => downloadProposalPdf(p)} className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400" title="Download PDF">
                      <FileDown size={15} />
                    </button>
                    <button
                      onClick={() => { setEditing(p); setEditContent(p.content); }}
                      className="text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"
                      title="Edit proposal"
                    >
                      <Pencil size={15} />
                    </button>
                    {canSendEmail && (
                    <button
                      onClick={() => { setSendTarget(p); setSendEmail(""); setSendName(""); }}
                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Send via email"
                    >
                      <Send size={15} />
                    </button>
                    )}
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/proposals/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: p.id }) });
                        const data = await res.json();
                        if (data.token) { await navigator.clipboard.writeText(`${window.location.origin}/review/${data.token}`); toast.success("Review link copied!"); }
                        else toast.error("Failed to generate link");
                      }}
                      className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                      title="Copy client review link"
                    >
                      <Link2 size={15} />
                    </button>
                    {p.status !== "accepted" && (
                      <button
                        onClick={() => updateStatus(p.id, "accepted")}
                        className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                        title="Mark as accepted"
                      >
                        <ThumbsUp size={15} />
                      </button>
                    )}
                    {p.status !== "rejected" && (
                      <button
                        onClick={() => updateStatus(p.id, "rejected")}
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        title="Mark as rejected"
                      >
                        <ThumbsDown size={15} />
                      </button>
                    )}
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
        );
      })()}

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
            <Button variant="outline" className="gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => selected && downloadProposalPdf(selected)}>
              <FileDown size={14} /> Download PDF
            </Button>
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
