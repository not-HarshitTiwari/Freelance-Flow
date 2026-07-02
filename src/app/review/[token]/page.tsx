"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, FileText, Loader2, Zap } from "lucide-react";

type Proposal = { id: string; title: string; content: string; status: string; amount: number | null };

export default function ProposalReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      fetch(`/api/proposals/review?token=${p.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error);
          else {
            setProposal(d.proposal);
            if (d.proposal.status === "accepted" || d.proposal.status === "rejected") {
              setDone(d.proposal.status as "accepted" | "rejected");
            }
          }
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function handleAction(action: "accepted" | "rejected") {
    setActing(true);
    const res = await fetch("/api/proposals/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    const data = await res.json();
    if (data.ok) setDone(action);
    else setError(data.error || "Something went wrong");
    setActing(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3">
        <Zap size={22} className="text-violet-600" />
        <span className="font-bold text-gray-900 dark:text-white">FreelanceFlow</span>
        <span className="text-gray-300 dark:text-gray-700 mx-1">|</span>
        <span className="text-gray-500 dark:text-gray-400 text-sm">Proposal Review</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-violet-600" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-24">
            <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        )}

        {!loading && proposal && !done && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{proposal.title}</h1>
              {proposal.amount && (
                <p className="text-violet-600 font-semibold text-lg mt-1">
                  ₹{proposal.amount.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-6 mb-6 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {proposal.content}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => handleAction("accepted")}
                disabled={acting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 h-11"
              >
                <CheckCircle size={18} /> Accept Proposal
              </Button>
              <Button
                onClick={() => handleAction("rejected")}
                disabled={acting}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 gap-2 h-11"
              >
                <XCircle size={18} /> Reject
              </Button>
            </div>
          </>
        )}

        {done && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {done === "accepted" ? (
              <>
                <CheckCircle size={56} className="text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Proposal Accepted!</h2>
                <p className="text-gray-500 dark:text-gray-400">The freelancer has been notified. They&apos;ll be in touch soon.</p>
              </>
            ) : (
              <>
                <XCircle size={56} className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Proposal Rejected</h2>
                <p className="text-gray-500 dark:text-gray-400">The freelancer has been notified.</p>
              </>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-12">Powered by FreelanceFlow</p>
      </div>
    </div>
  );
}
