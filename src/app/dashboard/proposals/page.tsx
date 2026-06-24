"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, FileText, Copy, Lock } from "lucide-react";
import { toast } from "sonner";

type Proposal = {
  id: string;
  title: string;
  content: string;
  status: string;
  amount: number | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-600",
  accepted: "bg-green-100 text-green-600",
  rejected: "bg-red-100 text-red-600",
};

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
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
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
      setIsPro(profile?.plan === "pro");
    });
  }, [fetchProposals]);

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
      setForm({ clientName: "", projectDescription: "", budget: "", timeline: "" });
      fetchProposals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate proposal";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
          <Lock size={28} className="text-violet-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
        <p className="text-gray-500 mb-6 max-w-xs">
          AI Proposal generation is a Pro feature. Upgrade to generate unlimited proposals in seconds.
        </p>
        <Link href="/dashboard/upgrade">
          <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
            <Sparkles size={16} /> Upgrade to Pro — ₹999/mo
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
          <p className="text-gray-500 text-sm mt-1">Generate AI-powered proposals in seconds</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 h-8 rounded-lg transition-colors">
            <Sparkles size={16} /> Generate Proposal
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate AI Proposal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  placeholder="Rahul Sharma / ABC Company"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Project Description</Label>
                <Textarea
                  placeholder="Build an e-commerce website with payment integration..."
                  value={form.projectDescription}
                  onChange={(e) => setForm({ ...form, projectDescription: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeline</Label>
                  <Input
                    placeholder="4 weeks"
                    value={form.timeline}
                    onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700"
                disabled={generating}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Sparkles size={16} className="animate-spin" /> Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles size={16} /> Generate with Gemini AI
                  </span>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No proposals yet</p>
          <p className="text-sm">Click &quot;Generate Proposal&quot; to create your first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelected(p)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{p.title}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {new Date(p.created_at).toLocaleDateString("en-IN")}
                    {p.amount && ` • ₹${p.amount.toLocaleString("en-IN")}`}
                  </p>
                </div>
                <Badge className={statusColors[p.status] || ""}>{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Proposal Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-gray-700 mt-2">
            {selected?.content}
          </div>
          <Button
            variant="outline"
            className="mt-4 gap-2"
            onClick={() => {
              navigator.clipboard.writeText(selected?.content || "");
              toast.success("Copied to clipboard!");
            }}
          >
            <Copy size={14} /> Copy Proposal
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
