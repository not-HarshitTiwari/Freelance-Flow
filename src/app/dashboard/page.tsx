import { createClient } from "@/lib/supabase/server";
import { getWorkspaceOwnerId } from "@/lib/team";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Users, IndianRupee, TrendingUp, Clock, FileSignature } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdBanner } from "@/components/ads/AdBanner";
import { RevenueChart } from "@/components/dashboard/RevenueChart";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await getWorkspaceOwnerId(supabase, user!.id);

  type InvRow = { total: number; status: string; invoice_date: string; created_at: string; customer_name: string | null; customer_company: string | null; amount_paid: number | null };
  type ExpRow = { amount: number; date: string };

  const [{ count: proposalCount }, { count: clientCount }, { data: rawInvoices }, { data: profile }, { data: rawExpenses }, { count: invoiceCount }] =
    await Promise.all([
      supabase.from("proposals").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
      supabase.from("invoices").select("total, status, invoice_date, created_at, customer_name, customer_company, amount_paid").eq("user_id", ownerId),
      supabase.from("profiles").select("plan, full_name, business_name, logo_url, signature_url, gstin").eq("id", ownerId).single(),
      supabase.from("expenses").select("amount, date").eq("user_id", ownerId),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
    ]);

  const invoices = (rawInvoices ?? []) as InvRow[];
  const expenses = (rawExpenses ?? []) as ExpRow[];

  const isPro = profile?.plan !== "free";

  // Onboarding checklist
  const onboardingSteps = [
    { label: "Complete your business profile", done: !!(profile?.full_name || profile?.business_name), href: "/dashboard/settings" },
    { label: "Upload your logo", done: !!profile?.logo_url, href: "/dashboard/settings" },
    { label: "Add your digital signature", done: !!profile?.signature_url, href: "/dashboard/settings" },
    { label: "Add your first client", done: (clientCount ?? 0) > 0, href: "/dashboard/clients" },
    { label: "Create your first invoice", done: (invoiceCount ?? 0) > 0, href: "/dashboard/invoices" },
    { label: "Create your first proposal", done: (proposalCount ?? 0) > 0, href: "/dashboard/proposals" },
  ];
  const onboardingDone = onboardingSteps.filter(s => s.done).length;
  const showOnboarding = onboardingDone < onboardingSteps.length;
  const totalEarned = invoices.reduce((s, i) =>
    s + (i.status === "paid" ? i.total : i.status === "partial" ? (i.amount_paid ?? 0) : 0), 0);
  const unpaidAmount = invoices.reduce((s, i) =>
    s + (i.status === "unpaid" ? i.total : i.status === "partial" ? i.total - (i.amount_paid ?? 0) : 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalEarned - totalExpenses;

  // Revenue by client (paid invoices only)
  const byClient = invoices
    .filter(i => i.status === "paid")
    .reduce<Record<string, number>>((acc, i) => {
      const name = i.customer_name || i.customer_company || "Unknown";
      acc[name] = (acc[name] || 0) + i.total;
      return acc;
    }, {});
  const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxClientRevenue = topClients[0]?.[1] ?? 1;

  // Build last 6 months chart data
  const months: { month: string; earned: number; unpaid: number }[] = [];
  for (let idx = 5; idx >= 0; idx--) {
    const d = new Date();
    d.setMonth(d.getMonth() - idx);
    const label = d.toLocaleString("en-IN", { month: "short" });
    const y = d.getFullYear(), m = d.getMonth();
    const monthInvoices = invoices.filter((inv: InvRow) => {
      const dt = new Date(inv.invoice_date || inv.created_at);
      return dt.getFullYear() === y && dt.getMonth() === m;
    });
    months.push({
      month: label,
      earned: monthInvoices.reduce((s: number, i: InvRow) =>
        s + (i.status === "paid" ? i.total : i.status === "partial" ? (i.amount_paid ?? 0) : 0), 0),
      unpaid: monthInvoices.reduce((s: number, i: InvRow) =>
        s + (i.status === "unpaid" ? i.total : i.status === "partial" ? i.total - (i.amount_paid ?? 0) : 0), 0),
    });
  }

  const name = (user?.user_metadata?.full_name as string)?.split(" ")[0] || "there";
  const hasContent = (proposalCount ?? 0) + (clientCount ?? 0) > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Good day, {name} 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Here&apos;s your business at a glance.</p>
      </div>

      {/* Onboarding checklist */}
      {showOnboarding && (
        <Card className="mb-8 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Get started — {onboardingDone}/{onboardingSteps.length} done</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Complete these steps to get the most out of FreelanceFlow</p>
              </div>
              <div className="w-12 h-12 relative">
                <svg viewBox="0 0 36 36" className="rotate-[-90deg] w-12 h-12">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7c3aed" strokeWidth="3"
                    strokeDasharray={`${(onboardingDone / onboardingSteps.length) * 100} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-violet-600">{Math.round((onboardingDone / onboardingSteps.length) * 100)}%</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {onboardingSteps.map(step => (
                <Link key={step.label} href={step.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${step.done ? "opacity-50 line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300 hover:bg-violet-100 dark:hover:bg-violet-900/30"}`}>
                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${step.done ? "bg-green-500 border-green-500" : "border-gray-300 dark:border-gray-600"}`}>
                    {step.done && <span className="text-white text-xs">✓</span>}
                  </span>
                  {step.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <IndianRupee size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Earned</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{totalEarned.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Receipt size={18} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Unpaid</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{unpaidAmount.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <IndianRupee size={18} className="text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">₹{totalExpenses.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${netProfit >= 0 ? "bg-violet-100 dark:bg-violet-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
                <TrendingUp size={18} className={netProfit >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-500"} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Net Profit</p>
                <p className={`text-xl font-bold ${netProfit >= 0 ? "text-gray-900 dark:text-white" : "text-red-500"}`}>₹{netProfit.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 dark:text-white">
            <TrendingUp size={16} className="text-violet-600" /> Revenue — Last 6 Months
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={months} />
        </CardContent>
      </Card>

      {topClients.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 dark:text-white">
              <Users size={16} className="text-violet-600" /> Revenue by Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topClients.map(([name, amount]) => (
              <div key={name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-xs">{name}</span>
                  <span className="text-gray-900 dark:text-white font-semibold shrink-0 ml-4">₹{amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(amount / maxClientRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isPro && hasContent && <AdBanner format="horizontal" className="mb-8" />}

      {/* Quick actions */}
      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <Card className="border-dashed border-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 dark:text-white"><FileText size={18} className="text-violet-600 dark:text-violet-400" /> New Proposal</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Generate an AI-powered proposal.</p>
            <Link href="/dashboard/proposals"><Button className="bg-violet-600 hover:bg-violet-700 w-full text-white">Create</Button></Link>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 dark:text-white"><Receipt size={18} className="text-orange-600 dark:text-orange-400" /> New Invoice</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create a GST invoice for your client.</p>
            <Link href="/dashboard/invoices"><Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300">Create</Button></Link>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 dark:text-white"><Users size={18} className="text-blue-600 dark:text-blue-400" /> Add Client</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add a client to manage their work.</p>
            <Link href="/dashboard/clients"><Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300">Add</Button></Link>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 dark:text-white"><IndianRupee size={18} className="text-red-500" /> Log Expense</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Track what you spend on projects.</p>
            <Link href="/dashboard/expenses"><Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300">Log</Button></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-dashed border-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 dark:text-white"><Clock size={18} className="text-violet-600 dark:text-violet-400" /> Time Tracking</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Track billable hours and convert to invoices.</p>
            <Link href="/dashboard/time-tracking"><Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300">Open Tracker</Button></Link>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 dark:text-white"><FileSignature size={18} className="text-violet-600 dark:text-violet-400" /> Contracts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create agreements and collect e-signatures.</p>
            <Link href="/dashboard/contracts"><Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300">New Contract</Button></Link>
          </CardContent>
        </Card>
      </div>

      {!isPro && hasContent && <AdBanner format="rectangle" className="mt-8 max-w-sm mx-auto" />}
    </div>
  );
}
