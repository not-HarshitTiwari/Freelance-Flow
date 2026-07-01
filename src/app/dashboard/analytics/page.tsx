import { createClient } from "@/lib/supabase/server";
import { getWorkspaceOwnerId } from "@/lib/team";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "@/components/dashboard/AnalyticsClient";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const [{ data: rawInvoices }, { data: rawExpenses }, { data: profile }] = await Promise.all([
    supabase
      .from("invoices")
      .select("total, status, invoice_date, created_at, customer_name, customer_company, amount_paid, items")
      .eq("user_id", ownerId),
    supabase.from("expenses").select("amount, date, category").eq("user_id", ownerId),
    supabase.from("profiles").select("plan").eq("id", ownerId).single(),
  ]);

  return (
    <AnalyticsClient
      invoices={rawInvoices ?? []}
      expenses={rawExpenses ?? []}
      isFree={(profile?.plan || "free") === "free"}
    />
  );
}
