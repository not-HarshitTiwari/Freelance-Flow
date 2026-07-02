import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { PayNowButton } from "@/components/portal/PayNowButton";

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  unpaid: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
};

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const res = await fetch(`${appUrl}/api/portal?token=${token}`, { cache: "no-store" });
  if (!res.ok) notFound();

  const { client, invoices, paidInvoices, proposals, freelancerPlan } = await res.json();
  const whiteLabel = freelancerPlan === "advanced";

  const totalDue = invoices?.reduce((s: number, i: { status: string; total: number; amount_paid?: number | null }) => {
    if (i.status === "unpaid") return s + i.total;
    if (i.status === "partial") return s + i.total - (i.amount_paid ?? 0);
    return s;
  }, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center gap-3">
        <Zap size={22} className="text-violet-600" />
        <span className="font-bold text-gray-900 dark:text-white">FreelanceFlow</span>
        <span className="text-gray-300 dark:text-gray-700 ml-1">|</span>
        <span className="text-gray-500 dark:text-gray-400 text-sm">Client Portal</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Client info */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hello, {client?.name} 👋</h1>
          {client?.company && <p className="text-gray-500 dark:text-gray-400 mt-1">{client.company}</p>}
          {totalDue > 0 && (
            <div className="mt-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-5 py-3 inline-flex items-center gap-2">
              <span className="text-orange-700 dark:text-orange-300 font-semibold text-sm">Amount Due:</span>
              <span className="text-orange-700 dark:text-orange-300 font-bold text-lg">₹{totalDue.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Invoices</h2>

        {!invoices?.length ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm">No invoices yet.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv: {
              id: string; invoice_number: string; invoice_date: string; due_date: string | null;
              total: number; status: string; payment_method: string | null; payment_methods: string[] | null;
              upi_id: string | null; bank_account_name: string | null; bank_account_number: string | null;
              bank_ifsc: string | null; bank_name: string | null; payment_link: string | null;
              amount_paid: number | null; notes: string | null;
            }) => (
              <Card key={inv.invoice_number} className="dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Issued {new Date(inv.invoice_date).toLocaleDateString("en-IN")}
                        {inv.due_date && ` • Due ${new Date(inv.due_date).toLocaleDateString("en-IN")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">₹{inv.total.toLocaleString("en-IN")}</span>
                      <Badge className={statusColors[inv.status] || "bg-gray-100 text-gray-600"}>{inv.status}</Badge>
                    </div>
                  </div>

                  {inv.status !== "paid" && (
                    <div className="space-y-2 mt-2">
                      <PayNowButton
                        invoiceId={inv.id}
                        invoiceNumber={inv.invoice_number}
                        portalToken={token}
                        clientName={client?.name}
                        clientEmail={client?.email}
                      />
                      {inv.payment_link && (
                        <a
                          href={inv.payment_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          Pay Online ↗
                        </a>
                      )}
                      {(() => {
                        const methods = inv.payment_methods?.length ? inv.payment_methods : inv.payment_method ? [inv.payment_method] : [];
                        if (!methods.length && !inv.upi_id && !inv.bank_account_number) return null;
                        return (
                          <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-sm space-y-1">
                            {methods.length > 0 && <p className="font-medium text-violet-700 dark:text-violet-300">Pay via {methods.join(", ")}</p>}
                            {inv.upi_id && <p className="text-violet-600 dark:text-violet-400">UPI ID: <strong>{inv.upi_id}</strong></p>}
                            {inv.bank_account_number && (
                              <>
                                <p className="text-violet-600 dark:text-violet-400">Account: <strong>{inv.bank_account_name}</strong></p>
                                <p className="text-violet-600 dark:text-violet-400">Acc No: <strong>{inv.bank_account_number}</strong></p>
                                <p className="text-violet-600 dark:text-violet-400">IFSC: <strong>{inv.bank_ifsc}</strong> · Bank: <strong>{inv.bank_name}</strong></p>
                              </>
                            )}
                          </div>
                        );
                      })()}
                      {(inv.amount_paid ?? 0) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          ₹{(inv.amount_paid ?? 0).toLocaleString("en-IN")} paid · Balance: ₹{(inv.total - (inv.amount_paid ?? 0)).toLocaleString("en-IN")} due
                        </p>
                      )}
                    </div>
                  )}

                  {inv.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{inv.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Paid invoices — collapsed section */}
        {paidInvoices?.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 select-none">
              {paidInvoices.length} paid invoice{paidInvoices.length !== 1 ? "s" : ""} ▸
            </summary>
            <div className="space-y-3 mt-3 opacity-70">
              {paidInvoices.map((inv: { id: string; invoice_number: string; invoice_date: string; total: number }) => (
                <Card key={inv.id} className="dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-300 font-medium">₹{inv.total.toLocaleString("en-IN")}</span>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">paid</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </details>
        )}

        {/* Proposals */}
        {proposals?.length > 0 && (
          <div className="mt-10">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Proposals</h2>
            <div className="space-y-3">
              {proposals.map((p: { id: string; title: string; status: string; created_at: string; project_type?: string }) => (
                <Card key={p.id} className="dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {p.project_type && `${p.project_type} · `}
                        {new Date(p.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <Badge className={
                      p.status === "accepted" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                      p.status === "sent" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }>{p.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!whiteLabel && <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-12">Powered by FreelanceFlow</p>}
      </div>
    </div>
  );
}
