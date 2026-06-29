import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Users, IndianRupee, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdBanner } from "@/components/ads/AdBanner";
import { RevenueChart } from "@/components/dashboard/RevenueChart";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  type InvRow = { total: number; status: string; invoice_date: string; created_at: string };
  type ExpRow = { amount: number; date: string };

  const [{ count: proposalCount }, { count: clientCount }, { data: rawInvoices }, { data: profile }, { data: rawExpenses }] =
    await Promise.all([
      supabase.from("proposals").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("invoices").select("total, status, invoice_date, created_at").eq("user_id", user!.id),
      supabase.from("profiles").select("plan").eq("id", user!.id).single(),
      supabase.from("expenses").select("amount, date").eq("user_id", user!.id),
    ]);

  const invoices = (rawInvoices ?? []) as InvRow[];
  const expenses = (rawExpenses ?? []) as ExpRow[];

  const isPro = profile?.plan === "pro";
  const totalEarned = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const unpaidAmount = invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalEarned - totalExpenses;

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
      earned: monthInvoices.filter((i: InvRow) => i.status === "paid").reduce((s: number, i: InvRow) => s + i.total, 0),
      unpaid: monthInvoices.filter((i: InvRow) => i.status === "unpaid").reduce((s: number, i: InvRow) => s + i.total, 0),
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

      {!isPro && hasContent && <AdBanner format="horizontal" className="mb-8" />}

      {/* Quick actions */}
      <div className="grid md:grid-cols-4 gap-4">
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

      {!isPro && hasContent && <AdBanner format="rectangle" className="mt-8 max-w-sm mx-auto" />}
    </div>
  );
}
