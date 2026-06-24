import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Users, IndianRupee } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ count: proposalCount }, { count: clientCount }, { data: invoices }] =
    await Promise.all([
      supabase.from("proposals").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("invoices").select("total, status").eq("user_id", user!.id),
    ]);

  const totalEarned = invoices?.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0) ?? 0;
  const unpaidAmount = invoices?.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.total, 0) ?? 0;

  const name = (user?.user_metadata?.full_name as string)?.split(" ")[0] || "there";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Good day, {name} 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Here&apos;s your business at a glance.</p>
      </div>

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
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <FileText size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Proposals</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{proposalCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Users size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Clients</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{clientCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 dark:text-white">
              <FileText size={18} className="text-violet-600 dark:text-violet-400" /> New Proposal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Generate an AI-powered proposal for your next project.</p>
            <Link href="/dashboard/proposals">
              <Button className="bg-violet-600 hover:bg-violet-700 w-full text-white">Create Proposal</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 dark:text-white">
              <Receipt size={18} className="text-orange-600 dark:text-orange-400" /> New Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create and send a professional invoice to your client.</p>
            <Link href="/dashboard/invoices">
              <Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Create Invoice</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 dark:text-white">
              <Users size={18} className="text-blue-600 dark:text-blue-400" /> Add Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add a new client to manage their projects and invoices.</p>
            <Link href="/dashboard/clients">
              <Button variant="outline" className="w-full dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Add Client</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
