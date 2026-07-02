import { createClient } from "@/lib/supabase/server";
import { getWorkspaceOwnerId } from "@/lib/team";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Users, IndianRupee, Clock, FileSignature } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdBanner } from "@/components/ads/AdBanner";
import { DashboardStats } from "@/components/dashboard/DashboardStats";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await getWorkspaceOwnerId(supabase, user!.id);

  type InvRow = { total: number; status: string; invoice_date: string; created_at: string; customer_name: string | null; customer_company: string | null; amount_paid: number | null; invoice_type: string | null };
  type ExpRow = { amount: number; date: string };

  const [{ count: proposalCount }, { count: clientCount }, { data: rawInvoices }, { data: profile }, { data: rawExpenses }, { count: invoiceCount }] =
    await Promise.all([
      supabase.from("proposals").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
      supabase.from("invoices").select("total, status, invoice_date, created_at, customer_name, customer_company, amount_paid, invoice_type").eq("user_id", ownerId),
      supabase.from("profiles").select("plan, full_name, business_name, logo_url, signature_url, gstin").eq("id", ownerId).single(),
      supabase.from("expenses").select("amount, date").eq("user_id", ownerId),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
    ]);

  const invoices = ((rawInvoices ?? []) as InvRow[]).filter(i => i.invoice_type !== "proforma");
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
      <DashboardStats
        totalEarned={totalEarned}
        unpaidAmount={unpaidAmount}
        totalExpenses={totalExpenses}
        netProfit={netProfit}
      />

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
