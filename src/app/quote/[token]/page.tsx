"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, FileSpreadsheet, Loader2, Download, Zap } from "lucide-react";
import { downloadQuotePdf } from "@/lib/quote-pdf";

type QuoteItem = { description: string; quantity: number; rate: number };
type Quote = {
  quote_number: string;
  items: QuoteItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst_type: string | null;
  gst_rate: number | null;
  total: number;
  status: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_gstin: string | null;
  customer_name: string | null;
  customer_company: string | null;
  created_at: string | null;
};

export default function QuoteReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      fetch(`/api/quotes/review?token=${p.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setError(d.error);
          else {
            setQuote(d.quote);
            if (d.quote.status === "accepted" || d.quote.status === "rejected") {
              setDone(d.quote.status as "accepted" | "rejected");
            }
          }
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function handleAction(action: "accepted" | "rejected") {
    setActing(true);
    const res = await fetch("/api/quotes/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    const data = await res.json();
    if (data.ok) {
      setDone(action);
      if (action === "accepted" && quote) {
        downloadQuotePdf(quote).catch(() => { /* best-effort local download */ });
      }
    } else {
      setError(data.error || "Something went wrong");
    }
    setActing(false);
  }

  const gstTotal = quote ? quote.cgst + quote.sgst + quote.igst : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3">
        <Zap size={22} className="text-violet-600" />
        <span className="font-bold text-gray-900 dark:text-white">FreelanceFlow</span>
        <span className="text-gray-300 dark:text-gray-700 mx-1">|</span>
        <span className="text-gray-500 dark:text-gray-400 text-sm">Quote Review</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-violet-600" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-24">
            <FileSpreadsheet size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
            <p className="text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        )}

        {!loading && quote && !done && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quote {quote.quote_number}</h1>
              {quote.valid_until && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Valid until {new Date(quote.valid_until).toLocaleDateString("en-IN")}</p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-6 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 dark:text-gray-500 border-b dark:border-gray-800">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Rate</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, i) => (
                    <tr key={i} className="border-b dark:border-gray-800 last:border-0">
                      <td className="py-2 text-gray-700 dark:text-gray-300">{item.description}</td>
                      <td className="py-2 text-right text-gray-700 dark:text-gray-300">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-700 dark:text-gray-300">₹{item.rate.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-right text-gray-900 dark:text-white font-medium">₹{(item.quantity * item.rate).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-col items-end mt-4 text-sm gap-1">
                <span className="text-gray-500 dark:text-gray-400">Subtotal: ₹{quote.subtotal.toLocaleString("en-IN")}</span>
                {gstTotal > 0 && <span className="text-gray-500 dark:text-gray-400">GST: ₹{gstTotal.toLocaleString("en-IN")}</span>}
                <span className="text-lg font-bold text-gray-900 dark:text-white">Total: ₹{quote.total.toLocaleString("en-IN")}</span>
              </div>
              {quote.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 whitespace-pre-wrap">{quote.notes}</p>}
              {quote.terms && (
                <div className="mt-4 pt-4 border-t dark:border-gray-800">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1">Terms</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
            </div>

            <Button onClick={() => downloadQuotePdf(quote)} variant="outline" className="w-full gap-2 h-10 mb-3 dark:border-gray-700 dark:text-gray-300">
              <Download size={16} /> Download Quote (PDF)
            </Button>

            <div className="flex gap-3">
              <Button onClick={() => handleAction("accepted")} disabled={acting} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2 h-11">
                <CheckCircle size={18} /> Accept Quote
              </Button>
              <Button onClick={() => handleAction("rejected")} disabled={acting} variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 gap-2 h-11">
                <XCircle size={18} /> Decline
              </Button>
            </div>
          </>
        )}

        {done && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {done === "accepted" ? (
              <>
                <CheckCircle size={56} className="text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quote Accepted!</h2>
                <p className="text-gray-500 dark:text-gray-400">The freelancer has been notified. They&apos;ll be in touch soon.</p>
              </>
            ) : (
              <>
                <XCircle size={56} className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quote Declined</h2>
                <p className="text-gray-500 dark:text-gray-400">The freelancer has been notified.</p>
              </>
            )}
            {quote && (
              <Button onClick={() => downloadQuotePdf(quote)} variant="outline" className="gap-2 mt-2 dark:border-gray-700 dark:text-gray-300">
                <Download size={16} /> Download Quote (PDF)
              </Button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-12">Powered by FreelanceFlow</p>
      </div>
    </div>
  );
}
